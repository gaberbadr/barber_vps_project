using System.Net;
using System.Net.Mail;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Email
{
    public class SmtpEmailSender
    {
        private readonly EmailOptions _emailOptions;
        private readonly ILogger<SmtpEmailSender>? _logger;

        public SmtpEmailSender(IOptions<EmailOptions> emailOptions, ILogger<SmtpEmailSender>? logger = null)
        {
            _emailOptions = emailOptions.Value;
            _logger = logger;
        }

        public async Task SendEmailAsync(string recipientEmail, string subject, string htmlBody)
        {
            if (string.IsNullOrWhiteSpace(_emailOptions.Host))
            {
                _logger?.LogError("SMTP failure: Email host is not configured.");
                throw new InvalidOperationException("Email host is not configured.");
            }

            if (string.IsNullOrWhiteSpace(_emailOptions.SenderEmail))
            {
                _logger?.LogError("SMTP failure: Sender email address is not configured.");
                throw new InvalidOperationException("Sender email address is not configured.");
            }

            if (_emailOptions.SmtpUsername == "your_email@gmail.com" || 
                _emailOptions.SmtpPassword == "your_email_password" ||
                string.IsNullOrWhiteSpace(_emailOptions.SmtpUsername) ||
                string.IsNullOrWhiteSpace(_emailOptions.SmtpPassword))
            {
                _logger?.LogError("SMTP failure: Default placeholder credentials detected. Please configure real SMTP credentials in environment variables.");
                throw new InvalidOperationException("SMTP credentials are not configured.");
            }

            using var client = new SmtpClient(_emailOptions.Host, _emailOptions.Port);
            client.EnableSsl = _emailOptions.EnableSsl;
            client.UseDefaultCredentials = false;
            client.Credentials = new NetworkCredential(_emailOptions.SmtpUsername, _emailOptions.SmtpPassword);
            client.DeliveryMethod = SmtpDeliveryMethod.Network;
            client.Timeout = 10000; // 10-second timeout to avoid request hanging indefinitely

            using var mailMessage = new MailMessage
            {
                From = new MailAddress(_emailOptions.SenderEmail, _emailOptions.SenderDisplayName, Encoding.UTF8),
                Subject = subject,
                SubjectEncoding = Encoding.UTF8,
                Body = htmlBody,
                BodyEncoding = Encoding.UTF8,
                IsBodyHtml = true
            };

            mailMessage.To.Add(recipientEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
                _logger?.LogInformation("Successfully sent email with subject '{Subject}' to recipient {RecipientMasked} via {Host}:{Port}",
                    subject, MaskEmail(recipientEmail), _emailOptions.Host, _emailOptions.Port);
            }
            catch (SmtpException smtpEx)
            {
                _logger?.LogError(smtpEx, "SMTP error while sending email to {RecipientMasked} via {Host}:{Port}. StatusCode: {StatusCode}",
                    MaskEmail(recipientEmail), _emailOptions.Host, _emailOptions.Port, smtpEx.StatusCode);
                throw;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to send email to {RecipientMasked} via {Host}:{Port}",
                    MaskEmail(recipientEmail), _emailOptions.Host, _emailOptions.Port);
                throw;
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