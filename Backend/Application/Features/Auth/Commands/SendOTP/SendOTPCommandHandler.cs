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

                // Check if user already has an active, unexpired verification code
                if (user.CodeExpiresAt != null && user.CodeExpiresAt > DateTime.UtcNow && !string.IsNullOrWhiteSpace(user.VerificationCode))
                {
                    var remaining = user.CodeExpiresAt.Value - DateTime.UtcNow;
                    var remainingFormatted = FormatRemainingTime(remaining);
                    _logger.LogInformation("Active OTP exists for email {EmailMasked}. Valid for {Remaining}. Suppressing new email.", MaskEmail(request.Email), remainingFormatted);

                    return Error.Conflict(
                        "auth.otp.active_code_exists",
                        $"لديك بالفعل كود تحقق نشط تم إرساله إلى بريدك. يرجى مراجعة رسائلك واستخدامه، أو الانتظار {remainingFormatted} قبل طلب كود جديد.");
                }

                // Generate 6-digit OTP with configured expiry window (default 360 minutes = 6 hours)
                var otp = new Random().Next(100000, 999999).ToString();
                var validMinutes = _emailConfiguration.ExpirationMinutes > 0
                    ? _emailConfiguration.ExpirationMinutes
                    : 360; // 6 hours
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

        private static string FormatRemainingTime(TimeSpan remaining)
        {
            var hours = (int)remaining.TotalHours;
            var minutes = remaining.Minutes;
            var seconds = remaining.Seconds;

            if (hours > 0)
            {
                var hourStr = hours switch
                {
                    1 => "ساعة واحدة",
                    2 => "ساعتين",
                    >= 3 and <= 10 => $"{hours} ساعات",
                    _ => $"{hours} ساعة"
                };

                if (minutes > 0)
                {
                    var minStr = minutes switch
                    {
                        1 => "دقيقة واحدة",
                        2 => "دقيقتين",
                        >= 3 and <= 10 => $"{minutes} دقائق",
                        _ => $"{minutes} دقيقة"
                    };
                    return $"{hourStr} و {minStr}";
                }

                return hourStr;
            }

            if (minutes > 0)
            {
                return minutes switch
                {
                    1 => "دقيقة واحدة",
                    2 => "دقيقتين",
                    >= 3 and <= 10 => $"{minutes} دقائق",
                    _ => $"{minutes} دقيقة"
                };
            }

            return $"{Math.Max(1, seconds)} ثانية";
        }
    }
}