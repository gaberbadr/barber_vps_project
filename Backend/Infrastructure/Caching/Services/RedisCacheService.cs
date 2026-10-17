using System;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using Application.Interfaces;

namespace Zero.Infrastructure.Caching.Services;

public sealed class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer? _multiplexer;
    private readonly ILogger<RedisCacheService> _logger;

    public RedisCacheService(
        IConnectionMultiplexer? multiplexer,
        ILogger<RedisCacheService> logger)
    {
        _multiplexer = multiplexer;
        _logger = logger;
    }

    private IDatabase? GetDatabase()
    {
        if (_multiplexer?.IsConnected == true)
        {
            try
            {
                return _multiplexer.GetDatabase();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get Redis database instance. Falling back to non-cached path.");
            }
        }
        return null;
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        var db = GetDatabase();
        if (db == null) return default;

        try
        {
            var value = await db.StringGetAsync(key);

            if (value.IsNullOrEmpty)
                return default;

            if (typeof(T) == typeof(string))
                return (T)(object)value.ToString();

            return JsonSerializer.Deserialize<T>(value.ToString());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis StringGetAsync failed for key: {Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
    {
        var db = GetDatabase();
        if (db == null) return;

        try
        {
            var data = value is string s
                ? s
                : JsonSerializer.Serialize(value);

            await db.StringSetAsync(key, data, expiration);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis StringSetAsync failed for key: {Key}", key);
        }
    }

    public async Task RemoveAsync(string key)
    {
        var db = GetDatabase();
        if (db == null) return;

        try
        {
            await db.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis KeyDeleteAsync failed for key: {Key}", key);
        }
    }

    public async Task<bool> ExistsAsync(string key)
    {
        var db = GetDatabase();
        if (db == null) return false;

        try
        {
            return await db.KeyExistsAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis KeyExistsAsync failed for key: {Key}", key);
            return false;
        }
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiration = null)
    {
        var cached = await GetAsync<T>(key);
        if (cached is not null) return cached;
        var value = await factory();
        await SetAsync(key, value, expiration);
        return value;
    }
}