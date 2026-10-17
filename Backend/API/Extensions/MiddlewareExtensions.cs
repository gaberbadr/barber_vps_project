using System.IO;
using System.Linq;
using API.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace API.Extensions
{
    /// <summary>
    /// Extension methods for configuring request middleware pipeline.
    /// </summary>
    public static class MiddlewareExtensions
    {
        /// <summary>
        /// Configures the HTTP request pipeline with all necessary middleware.
        /// </summary>
        public static WebApplication UseApiMiddlewares(this WebApplication app)
        {
            // Centralized Exception Handling at the very top of pipeline
            app.UseMiddleware<ExceptionMiddleware>();

            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                // Production exception handling - don't expose detailed errors
                app.UseExceptionHandler("/error");
            }

            // Configure Forwarded Headers to parse X-Forwarded-For and X-Forwarded-Proto from Nginx
            var forwardedHeadersOptions = new ForwardedHeadersOptions
            {
                ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | 
                                   Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
            };
            // Clear known networks/proxies so it trusts the Docker network proxy (Nginx)
            forwardedHeadersOptions.KnownNetworks.Clear();
            forwardedHeadersOptions.KnownProxies.Clear();
            app.UseForwardedHeaders(forwardedHeadersOptions);

            app.UseHttpsRedirection();

            // Configure file serving safely using WebHost Environment paths
            var webRootPath = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
            var filesPath = Path.Combine(webRootPath, "files");

            if (!Directory.Exists(filesPath))
            {
                Directory.CreateDirectory(filesPath);
            }

            var allowedExtensions = new[]
            {
                ".jpg", ".jpeg", ".png", ".gif", ".webp",
                ".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv",
                ".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".rtf"
            };

            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(filesPath),
                RequestPath = "/files",
                OnPrepareResponse = context =>
                {
                    var fileExtension = Path.GetExtension(context.File.Name).ToLowerInvariant();

                    if (!allowedExtensions.Contains(fileExtension))
                    {
                        context.Context.Response.StatusCode = StatusCodes.Status404NotFound;
                        context.Context.Response.ContentLength = 0;
                        context.Context.Response.Body = Stream.Null;
                        return;
                    }

                    context.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000";
                    context.Context.Response.ContentType = fileExtension switch
                    {
                        ".jpg" or ".jpeg" => "image/jpeg",
                        ".png" => "image/png",
                        ".gif" => "image/gif",
                        ".webp" => "image/webp",
                        ".mp4" => "video/mp4",
                        ".webm" => "video/webm",
                        ".ogg" => "video/ogg",
                        ".mov" => "video/quicktime",
                        ".avi" => "video/x-msvideo",
                        ".mkv" => "video/x-matroska",
                        ".pdf" => "application/pdf",
                        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        ".txt" => "text/plain",
                        ".rtf" => "application/rtf",
                        _ => "application/octet-stream"
                    };
                }
            });

            // Security headers for production
            if (!app.Environment.IsDevelopment())
            {
                app.Use(async (context, next) =>
                {
                    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
                    context.Response.Headers.Append("X-Frame-Options", "DENY");
                    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
                    context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
                    await next();
                });
            }

            app.UseCors("AllowFrontend");

            // Rate limiting middleware should be early in the pipeline, before authentication
            // to protect against brute force and bot attacks
            app.UseMiddleware<RateLimitMiddleware>();

            app.UseAuthentication();

            // Check if user is active (not blocked) after authentication
            app.UseMiddleware<UserActiveStatusMiddleware>();

            app.UseAuthorization();

            return app;
        }
    }
}