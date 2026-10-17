using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using API.Infrastructure.Persistence.Context;
using Application.Interfaces;
using Domain.Repositories;
using Infrastructure.Authentication;
using Infrastructure.Caching.Options;
using Infrastructure.Email;
using Infrastructure.Persistence.Repositories;
using Infrastructure.Storage.Options;
using Infrastructure.Storage.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Infrastructure.Time;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Zero.Infrastructure.Caching.Services;
using Zero.Infrastructure.Services;
using Microsoft.Extensions.Logging;

namespace Infrastructure
{
    public static class InfrastructureDependencyInjection
    {
        public static IServiceCollection AddInfrastructureServices(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            AddDatabaseContext(services, configuration);

            AddUnitOfWork(services);

            AddCachingServices(services, configuration);

            // Register TimeProvider
            services.AddSingleton<TimeProvider, EgyptTimeProvider>();

            // Local file storage with size-aware progressive WebP optimization
            services.Configure<LocalStorageOptions>(configuration.GetSection("LocalStorage"));
            services.AddScoped<IFileStorageService, LocalFileStorageService>();
            
            AddEmailServices(services, configuration);

            AddApplicationServices(services, configuration);

            services.AddHostedService<Infrastructure.BackgroundServices.BookingStatusUpdateService>();

            return services;
        }

        private static void AddDatabaseContext(
            IServiceCollection services,
            IConfiguration configuration)
        {
            var rawConnectionString = configuration.GetConnectionString("DefaultConnection")
                ?? configuration["DATABASE_URL"]
                ?? configuration.GetConnectionString("DATABASE_URL");

            if (string.IsNullOrWhiteSpace(rawConnectionString))
                throw new InvalidOperationException(
                    "DefaultConnection is not configured.");

            var connectionString = FormatPostgresConnectionString(rawConnectionString);

            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseNpgsql(connectionString);
            });
        }

        private static string FormatPostgresConnectionString(string connectionString)
        {
            if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
                connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            {
                var uri = new Uri(connectionString);
                var userInfo = uri.UserInfo?.Split(':');
                var builder = new Npgsql.NpgsqlConnectionStringBuilder
                {
                    Host = uri.Host,
                    Port = uri.Port > 0 ? uri.Port : 5432,
                    Username = userInfo != null && userInfo.Length > 0 ? userInfo[0] : "",
                    Password = userInfo != null && userInfo.Length > 1 ? userInfo[1] : "",
                    Database = uri.AbsolutePath.TrimStart('/'),
                    SslMode = Npgsql.SslMode.Prefer
                };
                return builder.ToString();
            }
            return connectionString;
        }

        private static void AddUnitOfWork(IServiceCollection services)
        {
            services.AddScoped<IUnitOfWork, UnitOfWork>();
        }

        private static void AddCachingServices(
            IServiceCollection services,
            IConfiguration configuration)
        {
            var redisOptions =
                configuration.GetSection("CacheSettings:Redis").Get<RedisOptions>()
                ?? new RedisOptions();

            services.Configure<RedisOptions>(
                configuration.GetSection("CacheSettings:Redis"));

            // If Redis is disabled, register null connection multiplexer
            // RateLimitService and RedisCacheService will handle gracefully with in-memory fallback
            if (!redisOptions.Enabled)
            {
                services.AddSingleton<IConnectionMultiplexer?>(sp => null);
                services.AddSingleton<ICacheService, RedisCacheService>();
                services.AddSingleton<IRateLimitService, RateLimitService>();
                return;
            }

            // Redis is enabled - validate configuration and register with safe connection handling
            var connectionString = configuration.GetConnectionString("REDIS_URL");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                // Log warning but don't crash - allow in-memory fallback
                // This ensures Production doesn't become unavailable due to missing Redis URL
                services.AddSingleton<IConnectionMultiplexer?>(sp =>
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    logger.LogWarning(
                        "Redis is enabled in configuration but ConnectionStrings:REDIS_URL is not configured. " +
                        "Rate limiting and caching will use in-memory fallback. " +
                        "This is not recommended for production environments with multiple instances.");
                    return null;
                });

                services.AddSingleton<ICacheService, RedisCacheService>();
                services.AddSingleton<IRateLimitService, RateLimitService>();
                return;
            }

            // Redis connection string is configured - attempt connection
            services.AddSingleton<IConnectionMultiplexer?>(sp =>
            {
                try
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    
                    ConfigurationOptions options;
                    if (connectionString.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) ||
                        connectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
                    {
                        var uri = new Uri(connectionString);
                        options = new ConfigurationOptions
                        {
                            AbortOnConnectFail = false,
                            Ssl = connectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase),
                            ConnectRetry = 3,
                            ConnectTimeout = redisOptions.ConnectTimeoutMs,
                            SyncTimeout = redisOptions.SyncTimeoutMs,
                            KeepAlive = 180
                        };
                        options.EndPoints.Add(uri.Host, uri.Port > 0 ? uri.Port : 6379);

                        var userInfo = uri.UserInfo?.Split(':', 2);
                        if (userInfo?.Length == 2)
                        {
                            options.User = userInfo[0];
                            options.Password = userInfo[1];
                        }
                    }
                    else
                    {
                        // Standard host:port format (e.g. "redis:6379")
                        options = ConfigurationOptions.Parse(connectionString);
                        options.AbortOnConnectFail = false;
                        options.ConnectRetry = 3;
                        options.ConnectTimeout = redisOptions.ConnectTimeoutMs;
                        options.SyncTimeout = redisOptions.SyncTimeoutMs;
                        options.KeepAlive = 180;
                    }

                    var connection = ConnectionMultiplexer.Connect(options);
                    
                    if (connection.IsConnected)
                    {
                        logger.LogInformation("Successfully connected to Redis at {Endpoints}", string.Join(",", options.EndPoints));
                    }
                    else
                    {
                        logger.LogWarning(
                            "Redis connection could not be established (AbortOnConnectFail=false allows graceful degradation). " +
                            "Rate limiting and caching will fall back to in-memory storage. " +
                            "This is not recommended for production environments with multiple instances.");
                    }

                    return connection;
                }
                catch (UriFormatException ex)
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    logger.LogError(
                        ex,
                        "Redis connection string is malformed. " +
                        "Expected format: redis://username:password@host:port. " +
                        "Rate limiting and caching will fall back to in-memory storage. " +
                        "This is not recommended for production environments with multiple instances.");
                    
                    return null;
                }
                catch (Exception ex)
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    logger.LogError(
                        ex,
                        "Failed to initialize Redis connection. " +
                        "Rate limiting and caching will fall back to in-memory storage. " +
                        "Check your ConnectionStrings:REDIS_URL configuration. " +
                        "This is not recommended for production environments with multiple instances.");
                    
                    return null;
                }
            });

            services.AddSingleton<ICacheService, RedisCacheService>();
            services.AddSingleton<IRateLimitService, RateLimitService>();
        }

        // Cloudinary storage services removed
        private static void AddEmailServices(
            IServiceCollection services,
            IConfiguration configuration)
        {
            var emailOptions = configuration.GetSection("Email").Get<EmailOptions>();

            if (emailOptions == null || string.IsNullOrWhiteSpace(emailOptions.SenderEmail))
            {
                return;
            }

            services.Configure<EmailOptions>(configuration.GetSection("Email"));

            services.AddScoped<IEmailConfiguration>(provider => 
                provider.GetRequiredService<IOptions<EmailOptions>>().Value);

            services.AddScoped<IEmailSender, EmailService>();
        }

        private static void AddApplicationServices(IServiceCollection services, IConfiguration configuration)
        {
            // Configure JWT options
            services.Configure<JwtOptions>(configuration.GetSection("JWT"));
            
            // Validate JWT configuration at startup to catch configuration issues early
            var jwtOptions = configuration.GetSection("JWT").Get<JwtOptions>();
            if (jwtOptions != null)
            {
                try
                {
                    jwtOptions.Validate();
                }
                catch (InvalidOperationException ex)
                {
                    throw new InvalidOperationException(
                        "JWT configuration validation failed during service registration. " +
                        "The application cannot start without valid JWT configuration.",
                        ex);
                }
            }
            else
            {
                throw new InvalidOperationException(
                    "JWT configuration section is not present in appsettings.json. " +
                    "A 'JWT' section with Key, Issuer, and Audience is required to start the application.");
            }
            
            services.AddScoped<IJwtService, JwtService>();

            services.Configure<RateLimitingOptions>(
                configuration.GetSection("RateLimiting"));
        }
    }
}
