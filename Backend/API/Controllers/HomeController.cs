using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Infrastructure.Email;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Controllers
{
    [ApiController]
    [Route("")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class HomeController : ControllerBase
    {
        [HttpGet("api/info")]
        public IActionResult Index()
        {
            return Ok(new
            {
                message = "أهلاً بيك في نظام الحلاق",
                version = "2.5.1",
                status = "Running",
                documentation = $"{Request.Scheme}://{Request.Host}/swagger",
                endpoints = new
                {
                    swagger = $"{Request.Scheme}://{Request.Host}/swagger",
                    health = $"{Request.Scheme}://{Request.Host}/health",
                    dbHealth = $"{Request.Scheme}://{Request.Host}/api/health/db",
                    emailHealth = $"{Request.Scheme}://{Request.Host}/api/health/email"
                },
                timestamp = DateTime.UtcNow
            });
        }

        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new
            {
                status = "Healthy",
                timestamp = DateTime.UtcNow,
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
            });
        }

        [HttpGet("api/health/db")]
        public async Task<IActionResult> CheckDatabase([FromServices] API.Infrastructure.Persistence.Context.ApplicationDbContext dbContext)
        {
            try
            {
                var canConnect = await dbContext.Database.CanConnectAsync();
                if (canConnect)
                {
                    return Ok(new
                    {
                        status = "Healthy",
                        database = "Connected",
                        provider = "PostgreSQL",
                        timestamp = DateTime.UtcNow
                    });
                }

                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    status = "Unhealthy",
                    database = "Disconnected",
                    message = "Database is unreachable. Verify DATABASE_URL in Blitz dashboard.",
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    status = "Unhealthy",
                    database = "ConnectionFailed",
                    message = "Failed to connect to configured PostgreSQL server. Verify DATABASE_URL in Blitz dashboard.",
                    timestamp = DateTime.UtcNow
                });
            }
        }

        [HttpGet("api/health/email")]
        public async Task<IActionResult> CheckEmailHealth(
            [FromServices] IOptions<EmailOptions> emailOptionsAccessor,
            [FromQuery] string? host = null,
            [FromQuery] int? port = null)
        {
            var options = emailOptionsAccessor.Value;
            var targetHost = !string.IsNullOrWhiteSpace(host) 
                ? host.Trim() 
                : (string.IsNullOrWhiteSpace(options.Host) ? "smtp.gmail.com" : options.Host);
            var targetPort = port.HasValue && port.Value > 0 
                ? port.Value 
                : (options.Port > 0 ? options.Port : 587);
            var isConfigured = !string.IsNullOrWhiteSpace(options.SmtpUsername) &&
                               options.SmtpUsername != "your_email@gmail.com" &&
                               !string.IsNullOrWhiteSpace(options.SmtpPassword) &&
                               options.SmtpPassword != "your_email_password";

            var result = new Dictionary<string, object>
            {
                ["host"] = targetHost,
                ["port"] = targetPort,
                ["enableSsl"] = options.EnableSsl,
                ["isConfigured"] = isConfigured,
                ["senderConfigured"] = !string.IsNullOrWhiteSpace(options.SenderEmail) && options.SenderEmail != "your_email@gmail.com",
                ["timestamp"] = DateTime.UtcNow
            };

            // 1. Check DNS resolution
            try
            {
                var addresses = await Dns.GetHostAddressesAsync(targetHost);
                result["dnsResolution"] = "Success";
                result["resolvedIpCount"] = addresses.Length;
            }
            catch (Exception ex)
            {
                result["dnsResolution"] = "Failed";
                result["dnsError"] = ex.Message;
                result["status"] = "Unhealthy";
                return StatusCode(StatusCodes.Status503ServiceUnavailable, result);
            }

            // 2. Check outbound TCP connectivity with a 5-second timeout
            try
            {
                using var tcpClient = new TcpClient();
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await tcpClient.ConnectAsync(targetHost, targetPort, cts.Token);
                result["tcpConnection"] = "Connected";
                result["status"] = isConfigured ? "Healthy" : "Degraded (Credentials not configured)";
                return Ok(result);
            }
            catch (OperationCanceledException)
            {
                result["tcpConnection"] = "TimedOut";
                result["status"] = "Unhealthy";
                result["diagnosticDetail"] = $"Outbound TCP connection to {targetHost}:{targetPort} timed out after 5 seconds. Blitz.cloud blocks outbound ports 25, 465, and 587. Consider using port 2525 or a transactional email HTTP API (e.g. Brevo/Resend).";
                return StatusCode(StatusCodes.Status503ServiceUnavailable, result);
            }
            catch (Exception ex)
            {
                result["tcpConnection"] = "Failed";
                result["tcpError"] = ex.Message;
                result["status"] = "Unhealthy";
                result["diagnosticDetail"] = $"Outbound TCP connection to {targetHost}:{targetPort} failed: {ex.Message}. Blitz.cloud blocks outbound ports 25, 465, and 587. Consider using port 2525 or a transactional email HTTP API.";
                return StatusCode(StatusCodes.Status503ServiceUnavailable, result);
            }
        }
    }
}
