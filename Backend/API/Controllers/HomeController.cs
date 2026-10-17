using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

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
                    health = $"{Request.Scheme}://{Request.Host}/health"
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
    }
}
