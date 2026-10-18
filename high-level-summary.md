# High-Level Architecture Summary

Here is a complete, high-level summary of your production architecture on Blitz.cloud and local Docker Compose development.

## 1. Production Architecture on Blitz.cloud

On Blitz.cloud, the application runs as a production-grade containerized service connected to managed infrastructure:

- **Unified Production Container**: Built via the root `Dockerfile`.
  - Compiles the React SPA (`FrontEnd/`) via Vite into static assets in `wwwroot`.
  - Compiles the ASP.NET Core 8 Web API (`Backend/`) in Release mode.
  - Serves `/` and all frontend routes via SPA fallback (`MapFallbackToFile("index.html")`).
  - Serves `/api/...`, `/swagger/...`, `/health`, `/files/...`, and `/signin-google` directly.
  - Total memory consumption: ~150-180 MB RAM (well under the 512 MB Free Plan limit).
- **Managed Database (`barber-db`)**: Blitz.cloud Managed PostgreSQL 17 (128 MB RAM).
  - Automatically provisions persistent storage and automated nightly off-site backups.
  - Injects `DATABASE_URL` directly into the application environment.
- **Managed Cache (Upstash Redis / TLS)**:
  - Connected via Upstash external Redis (`rediss://` with TLS on port 6379).
  - Securely parses credentials, enables SNI verification, and provides distributed caching and rate limiting.
  - Fallback to in-memory caching and rate limiting is supported if Redis is disabled.
- **Blitz Edge Router**:
  - Handles incoming HTTPS traffic on port 443 at `barber.devs.surf`.
  - Terminates TLS with auto-renewing Let's Encrypt certificates.
  - Forwards requests to the container on port 8080 with `X-Forwarded-Proto: https` and `X-Forwarded-Host`.

## 2. Local Development Architecture (`docker-compose.yml`)

For local development on your machine, `docker-compose.yml` provides a multi-container isolated cluster:

- **Frontend (`barber-frontend`)**: Nginx alpine container serving the React SPA on port 80.
- **Backend (`barber-api`)**: ASP.NET Core API running on port 8080.
- **Reverse Proxy (`barber-nginx`)**: Self-contained Nginx image (`nginx/Dockerfile`) routing `/` to `frontend:80` and `/api/`, `/swagger/`, `/health`, `/files/`, `/signin-google` to `backend:8080`.
- **Database**: Connects to Blitz's managed PostgreSQL database via `DATABASE_URL`. Self-hosted PostgreSQL container and local `postgres_data` volume have been removed.
- **Cache**: Connects to the external Upstash Redis instance (or in-memory cache). Obsolete local Redis container removed.
- **Database Management**: Managed externally from your PC using pgAdmin 4 or DBeaver connected directly to Blitz's managed PostgreSQL database.

## 3. Configuration & Environment Variables

- **The Backend**: In production, `DATABASE_URL` (injected by Blitz Managed PostgreSQL) is authoritative and mandatory. In local development, `DATABASE_URL` or `ConnectionStrings__DefaultConnection` is supported. `REDIS_URL` connects securely to Upstash with TLS (`rediss://`). All connection URIs are parsed dynamically into ADO.NET Npgsql and StackExchange.Redis options with full SSL/SNI support and zero secret leakage.
- **Security & JWT**: Configured via `JWT__Key`, `JWT__Issuer`, and `JWT__Audience`.
- **Reverse Proxy & Forwarded Headers**: ASP.NET Core `UseForwardedHeaders` parses `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` while trusting proxy networks. `HttpsPort` is set to 443 to avoid redirect warnings.
- **Google OAuth**: Preserves callback at `/signin-google` with matching public HTTPS domain.

## 4. Frontend API Resolution & Routing

- In `FrontEnd/src/api/axiosInstance.ts`:
  - `baseURL` normalizes `VITE_API_BASE_URL` and defaults to `''` for same-origin production.
  - Prevents URL duplication (e.g. avoiding `/api/api/services`).
  - Calls to `/api/services`, `/api/bookings`, `/api/Auth/...` resolve seamlessly to `https://barber.devs.surf/api/...`.
