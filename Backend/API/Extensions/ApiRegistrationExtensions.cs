using Microsoft.Extensions.DependencyInjection;

namespace API.Extensions
{
    /// <summary>
    /// Extension methods for registering core API services.
    /// </summary>
    public static class ApiRegistrationExtensions
    {
        /// <summary>
        /// Adds core API layer services including HTTP context accessor.
        /// </summary>
        public static IServiceCollection AddApiLayerServices(this IServiceCollection services)
        {
            // HTTP Context accessor must be registered before it's used
            services.AddHttpContextAccessor();

            // Set explicit HTTPS port for reverse proxy / edge proxy SSL termination
            services.AddHttpsRedirection(options =>
            {
                options.HttpsPort = 443;
            });

            return services;
        }
    }
}