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
            var isProduction = string.Equals(
                configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                "Production",
                StringComparison.OrdinalIgnoreCase);

            var databaseUrl = configuration["DATABASE_URL"]
                ?? configuration.GetConnectionString("DATABASE_URL")
                ?? configuration["POSTGRES_URL"];

            string rawConnectionString;

            if (isProduction)
            {
                // In production, DATABASE_URL injected by Blitz.cloud Managed PostgreSQL is authoritative.
                // Fail fast with clear diagnostic message; never silently fall back to legacy connection strings.
                if (string.IsNullOrWhiteSpace(databaseUrl))
                {
                    throw new InvalidOperationException(
                        "Production database configuration failed: DATABASE_URL is not set. " +
                        "In Blitz.cloud, connect your Managed PostgreSQL database ('barberDB') or configure DATABASE_URL in Environment Variables.");
                }

                rawConnectionString = databaseUrl;
            }
            else
            {
                // Local development / testing: prioritize DATABASE_URL if configured, otherwise use DefaultConnection
                var defaultConn = configuration.GetConnectionString("DefaultConnection");

                if (!string.IsNullOrWhiteSpace(databaseUrl))
                {
                    rawConnectionString = databaseUrl;
                }
                else if (!string.IsNullOrWhiteSpace(defaultConn))
                {
                    rawConnectionString = defaultConn;
                }
                else
                {
                    throw new InvalidOperationException(
                        "Database connection string is not configured. Set DATABASE_URL or ConnectionStrings:DefaultConnection in your local environment.");
                }
            }

            var connectionString = FormatPostgresConnectionString(rawConnectionString);

            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseNpgsql(connectionString, npgsqlOptions =>
                {
                    npgsqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(10),
                        errorCodesToAdd: null);
                });
            });
        }

        private static string FormatPostgresConnectionString(string connectionString)
        {
            if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
                connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            {
                var uri = new Uri(connectionString);
                var userInfo = uri.UserInfo?.Split(':', 2);
                var username = userInfo != null && userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
                var password = userInfo != null && userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
                var database = uri.AbsolutePath.Trim('/');

                var builder = new Npgsql.NpgsqlConnectionStringBuilder
                {
                    Host = uri.Host,
                    Port = uri.Port > 0 ? uri.Port : 5432,
                    Username = username,
                    Password = password,
                    Database = database,
                    SslMode = Npgsql.SslMode.Prefer,
                    Timeout = 15,
                    CommandTimeout = 30
                };

                if (!string.IsNullOrWhiteSpace(uri.Query))
                {
                    var query = uri.Query.TrimStart('?').Split('&');
                    foreach (var param in query)
                    {
                        var kv = param.Split('=', 2);
                        if (kv.Length == 2)
                        {
                            var key = kv[0].Trim();
                            var val = Uri.UnescapeDataString(kv[1].Trim());
                            if (key.Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                            {
                                if (Enum.TryParse<Npgsql.SslMode>(val, true, out var sslMode))
                                {
                                    builder.SslMode = sslMode;
                                }
                            }
                        }
                    }
                }

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
                services.AddSingleton<IConnectionMultiplexer>(sp => null!);
                services.AddSingleton<ICacheService, RedisCacheService>();
                services.AddSingleton<IRateLimitService, RateLimitService>();
                return;
            }

            // Redis is enabled - resolve connection string across both ConnectionStrings and top-level ENV
            var envRedis = configuration["REDIS_URL"]
                ?? configuration["REDIS_CONNECTION_STRING"];
            var connRedis = configuration.GetConnectionString("REDIS_URL")
                ?? configuration.GetConnectionString("Redis");

            string? connectionString = null;
            if (!string.IsNullOrWhiteSpace(envRedis) && !envRedis.Equals("redis:6379", StringComparison.OrdinalIgnoreCase))
            {
                connectionString = envRedis;
            }
            else if (!string.IsNullOrWhiteSpace(connRedis) && !connRedis.Equals("redis:6379", StringComparison.OrdinalIgnoreCase))
            {
                connectionString = connRedis;
            }
            else
            {
                connectionString = !string.IsNullOrWhiteSpace(envRedis) ? envRedis : connRedis;
            }

            if (string.IsNullOrWhiteSpace(connectionString) || connectionString.Equals("redis:6379", StringComparison.OrdinalIgnoreCase))
            {
                // Log warning but don't crash - allow in-memory fallback
                // This ensures Production doesn't become unavailable due to missing Redis URL
                services.AddSingleton<IConnectionMultiplexer>(sp =>
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    logger.LogWarning(
                        "Redis is enabled in configuration but REDIS_URL is not configured with a valid endpoint. " +
                        "Rate limiting and caching will fall back to in-memory storage. " +
                        "Provide a valid REDIS_URL (e.g., Upstash or Blitz Managed Redis), or disable Redis.");
                    return null!;
                });

                services.AddSingleton<ICacheService, RedisCacheService>();
                services.AddSingleton<IRateLimitService, RateLimitService>();
                return;
            }

            // Redis connection string is configured - attempt connection
            services.AddSingleton<IConnectionMultiplexer>(sp =>
            {
                try
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    
                    ConfigurationOptions options;
                    if (connectionString.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) ||
                        connectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
                    {
                        var uri = new Uri(connectionString);
                        var isSsl = connectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase);
                        options = new ConfigurationOptions
                        {
                            AbortOnConnectFail = false,
                            Ssl = isSsl,
                            ConnectRetry = 3,
                            ConnectTimeout = redisOptions.ConnectTimeoutMs,
                            SyncTimeout = redisOptions.SyncTimeoutMs,
                            KeepAlive = 180
                        };
                        options.EndPoints.Add(uri.Host, uri.Port > 0 ? uri.Port : (isSsl ? 6380 : 6379));

                        if (isSsl)
                        {
                            options.SslHost = uri.Host;
                        }

                        if (!string.IsNullOrEmpty(uri.UserInfo))
                        {
                            var userInfo = uri.UserInfo.Split(':', 2);
                            if (userInfo.Length == 2)
                            {
                                var user = Uri.UnescapeDataString(userInfo[0]);
                                var pass = Uri.UnescapeDataString(userInfo[1]);
                                if (!string.IsNullOrWhiteSpace(user))
                                {
                                    options.User = user;
                                }
                                if (!string.IsNullOrWhiteSpace(pass))
                                {
                                    options.Password = pass;
                                }
                            }
                            else if (userInfo.Length == 1 && !string.IsNullOrWhiteSpace(userInfo[0]))
                            {
                                options.Password = Uri.UnescapeDataString(userInfo[0]);
                            }
                        }
                    }
                    else
                    {
                        // Standard host:port format (e.g. "endpoint:6379")
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
                            "Redis connection could not be established to {Endpoints}. " +
                            "Verify REDIS_URL in Blitz dashboard. Caching will fall back to in-memory.",
                            string.Join(",", options.EndPoints));
                    }

                    return connection;
                }
                catch (UriFormatException ex)
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    logger.LogError(
                        ex,
                        "Redis connection string is malformed. " +
                        "Expected format: redis://:password@host:port or host:port. " +
                        "Rate limiting and caching will fall back to in-memory storage.");
                    
                    return null!;
                }
                catch (Exception ex)
                {
                    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis.Configuration");
                    logger.LogError(
                        ex,
                        "Failed to initialize Redis connection. " +
                        "Rate limiting and caching will fall back to in-memory storage. " +
                        "Check your REDIS_URL configuration in Blitz dashboard.");
                    
                    return null!;
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
            var emailSection = configuration.GetSection("Email").Exists() 
                ? configuration.GetSection("Email") 
                : configuration.GetSection("EmailSettings");

            services.Configure<EmailOptions>(options =>
            {
                if (emailSection.Exists())
                {
                    emailSection.Bind(options);
                }

                // Support common environment variable aliases often used on cloud platforms:
                var host = configuration["Email__Host"] 
                    ?? configuration["EmailSettings__Host"] 
                    ?? configuration["SMTP_HOST"] 
                    ?? configuration["EMAIL_HOST"]
                    ?? configuration["Email:Host"];
                if (!string.IsNullOrWhiteSpace(host)) options.Host = host.Trim();

                var portStr = configuration["Email__Port"] 
                    ?? configuration["EmailSettings__Port"] 
                    ?? configuration["SMTP_PORT"] 
                    ?? configuration["EMAIL_PORT"]
                    ?? configuration["Email:Port"];
                if (!string.IsNullOrWhiteSpace(portStr) && int.TryParse(portStr.Trim(), out var port)) options.Port = port;

                var user = configuration["Email__SmtpUsername"] 
                    ?? configuration["EmailSettings__SmtpUsername"]
                    ?? configuration["Email__Username"]
                    ?? configuration["EmailSettings__Username"]
                    ?? configuration["SMTP_USERNAME"] 
                    ?? configuration["SMTP_USER"] 
                    ?? configuration["EMAIL_USERNAME"] 
                    ?? configuration["EMAIL_USER"]
                    ?? configuration["Email:SmtpUsername"];
                if (!string.IsNullOrWhiteSpace(user)) options.SmtpUsername = user.Trim();

                var pass = configuration["Email__SmtpPassword"] 
                    ?? configuration["EmailSettings__SmtpPassword"]
                    ?? configuration["Email__Password"]
                    ?? configuration["EmailSettings__Password"]
                    ?? configuration["SMTP_PASSWORD"] 
                    ?? configuration["SMTP_PASS"] 
                    ?? configuration["EMAIL_PASSWORD"] 
                    ?? configuration["EMAIL_PASS"]
                    ?? configuration["Email:SmtpPassword"];
                if (!string.IsNullOrWhiteSpace(pass)) options.SmtpPassword = pass.Trim();

                var sender = configuration["Email__SenderEmail"] 
                    ?? configuration["EmailSettings__SenderEmail"]
                    ?? configuration["Email__From"] 
                    ?? configuration["EmailSettings__From"] 
                    ?? configuration["SMTP_FROM"] 
                    ?? configuration["EMAIL_FROM"] 
                    ?? configuration["EMAIL_SENDER"] 
                    ?? configuration["SENDER_EMAIL"]
                    ?? configuration["Email:SenderEmail"];
                if (!string.IsNullOrWhiteSpace(sender)) options.SenderEmail = sender.Trim();

                var displayName = configuration["Email__SenderDisplayName"] 
                    ?? configuration["EmailSettings__SenderDisplayName"]
                    ?? configuration["Email__DisplayName"] 
                    ?? configuration["EmailSettings__DisplayName"] 
                    ?? configuration["SMTP_DISPLAY_NAME"] 
                    ?? configuration["EMAIL_DISPLAY_NAME"]
                    ?? configuration["Email:SenderDisplayName"];
                if (!string.IsNullOrWhiteSpace(displayName)) options.SenderDisplayName = displayName.Trim();

                var sslStr = configuration["Email__EnableSsl"] 
                    ?? configuration["EmailSettings__EnableSsl"]
                    ?? configuration["SMTP_SSL"] 
                    ?? configuration["EMAIL_SSL"]
                    ?? configuration["Email:EnableSsl"];
                if (!string.IsNullOrWhiteSpace(sslStr) && bool.TryParse(sslStr.Trim(), out var ssl)) options.EnableSsl = ssl;

                var expStr = configuration["Email__ExpirationMinutes"] 
                    ?? configuration["EmailSettings__ExpirationMinutes"]
                    ?? configuration["Email:ExpirationMinutes"];
                if (!string.IsNullOrWhiteSpace(expStr) && int.TryParse(expStr.Trim(), out var exp)) options.ExpirationMinutes = exp;
            });

            services.AddScoped<IEmailConfiguration>(provider => 
                provider.GetRequiredService<IOptions<EmailOptions>>().Value);

            services.AddScoped<SmtpEmailSender>();
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
