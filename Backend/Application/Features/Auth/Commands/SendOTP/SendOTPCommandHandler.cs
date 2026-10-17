using Application.Interfaces;
using Domain.Entities;
using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Error = ErrorOr.Error;

namespace Application.Features.Auth.Commands.SendOTP
{
    public class SendOTPCommandHandler : IRequestHandler<SendOTPCommand, ErrorOr<Success>>
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailSender _emailSender;
        private readonly IEmailConfiguration _emailConfiguration;
        private readonly ILogger<SendOTPCommandHandler> _logger;

        public SendOTPCommandHandler(
            UserManager<ApplicationUser> userManager,
            IEmailSender emailSender,
            IEmailConfiguration emailConfiguration,
            ILogger<SendOTPCommandHandler> logger)
        {
            _userManager = userManager;
            _emailSender = emailSender;
            _emailConfiguration = emailConfiguration;
            _logger = logger;
        }

        public async Task<ErrorOr<Success>> Handle(SendOTPCommand request, CancellationToken cancellationToken)
        {
            try
            {
                // Find or create user
                var user = await _userManager.FindByEmailAsync(request.Email);
                if (user == null)
                {
                    user = new ApplicationUser
                    {
                        Email = request.Email,
                        UserName = request.Email,
                        EmailConfirmed = false
                    };
                    var result = await _userManager.CreateAsync(user);
                    if (!result.Succeeded)
                    {
                        _logger.LogWarning("Failed to create user account for email {EmailMasked}", MaskEmail(request.Email));
                        return Error.Failure("auth.user.creation.failed", "فشل إنشاء حساب المستخدم.");
                    }
                }

                // Check if user is blocked
                if (!user.IsActive)
                {
                    _logger.LogWarning("Blocked user attempted OTP generation: {EmailMasked}", MaskEmail(request.Email));
                    return Error.Failure("auth.user.blocked", "حسابك موقوف. يرجى التواصل مع الدعم.");
                }

                // Rate-limiting / cooldown check:
                // Only throttle if a verification code was already requested within the last 60 seconds
                if (user.UpdatedAt != null && user.CodeExpiresAt != null && user.CodeExpiresAt > DateTime.UtcNow)
                {
                    var secondsSinceLastRequest = (DateTime.UtcNow - user.UpdatedAt.Value).TotalSeconds;
                    if (secondsSinceLastRequest >= 0 && secondsSinceLastRequest < 60)
                    {
                        var remainingSeconds = Math.Max(1, (int)Math.Ceiling(60 - secondsSinceLastRequest));
                        _logger.LogWarning("Throttled OTP request for email {EmailMasked}. Must wait {Remaining}s", MaskEmail(request.Email), remainingSeconds);
                        return Error.Conflict("auth.otp.cooldown", $"يرجى الانتظار {remainingSeconds} ثانية قبل طلب كود جديد.");
                    }
                }

                // Generate 6-digit OTP with a realistic 5-minute expiry window (preventing accidental 12-hour lockout)
                var otp = new Random().Next(100000, 999999).ToString();
                var validMinutes = _emailConfiguration.ExpirationMinutes > 0 && _emailConfiguration.ExpirationMinutes <= 15
                    ? _emailConfiguration.ExpirationMinutes
                    : 5;
                user.SetVerificationCode(otp, DateTime.UtcNow.AddMinutes(validMinutes));

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    _logger.LogError("Failed to update user with verification code for email {EmailMasked}", MaskEmail(request.Email));
                    return Error.Failure("auth.otp.generation.failed", "فشل إنشاء كود التحقق.");
                }

                var userName = !string.IsNullOrWhiteSpace(user.FullName)
                    ? user.FullName
                    : request.Email.Split('@')[0];

                // Send OTP via email
                try
                {
                    await _emailSender.SendOtpEmailAsync(
                        request.Email,
                        userName,
                        otp);
                }
                catch (Exception mailEx)
                {
                    _logger.LogError(mailEx, "Failed to deliver OTP verification email to recipient {EmailMasked}", MaskEmail(request.Email));

                    // Roll back verification code in database so the user is not locked out by a phantom code
                    try
                    {
                        user.ClearVerificationCode();
                        await _userManager.UpdateAsync(user);
                    }
                    catch (Exception dbEx)
                    {
                        _logger.LogError(dbEx, "Failed to reset verification code for recipient {EmailMasked} after email failure", MaskEmail(request.Email));
                    }

                    return Error.Unexpected("auth.email.delivery_failed", "تعذر إرسال كود التحقق حالياً. يرجى المحاولة لاحقاً.");
                }

                return Result.Success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in SendOTPCommandHandler for recipient {EmailMasked}", MaskEmail(request.Email));
                return Error.Unexpected("auth.otp.unexpected", "حدث خطأ غير متوقع أثناء معالجة الطلب.");
            }
        }

        private static string MaskEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return "unknown";
            var atIndex = email.IndexOf('@');
            if (atIndex <= 1) return "***" + email[atIndex..];
            return string.Concat(email.AsSpan(0, 1), "***", email.AsSpan(atIndex));
        }
    }
}