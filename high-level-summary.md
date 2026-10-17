# High-Level Architecture Summary

Here is a complete, high-level summary of your entire production architecture and how everything flows together.

## 1. The Containers (The "Services")
Your application is broken down into isolated services running inside a private Docker network (`barber-network`):

- **Frontend (`barber-frontend`)**: A lightweight Nginx alpine image that serves your built React SPA.
- **Backend (`barber-api`)**: Your ASP.NET Core API running on a Linux .NET 8 runtime.
- **Database (`barber-postgres`)**: PostgreSQL 16. It saves its data persistently to a Docker volume (`postgres_data`) so data isn't lost across restarts or redeployments.
- **Cache (`barber-redis`)**: A Redis container used for fast caching and distributed rate limiting (with automatic in-memory fallback).
- **Reverse Proxy (`barber-nginx`)**: The internal entrypoint for your application. It routes incoming traffic from the Blitz.cloud edge router to the Frontend (`/`), Backend (`/api/`), Swagger (`/swagger/`), Uploads (`/files/`), and Health Check (`/health`).
- **Database Administration (`barber-pgadmin`)**: pgAdmin 4 for administrative operations, bound locally for security.

## 2. The Configuration Flow (Environment Variables)
Configuration is managed through environment variables (set in Blitz.cloud dashboard or `.env` file):

- **The Backend**: Docker/Blitz.cloud injects variables into the backend. Because ASP.NET understands double underscores (`__`), it automatically overrides matching configuration in `appsettings.json` (such as `JWT__Key` or `ConnectionStrings__DefaultConnection`).
- **The Database**: Docker reads `DB_PASSWORD` and uses it to configure PostgreSQL authentication.
- **The Frontend**: The frontend is built as static HTML/JS/CSS assets that send requests to `/api`.

## 3. The Traffic Flow (Blitz.cloud Edge + Nginx)
Security and routing flow:

When a user visits `https://barber.devs.surf`:
1. The request hits Blitz.cloud's managed edge reverse proxy on port 443.
2. Blitz.cloud terminates TLS/HTTPS using its automatically managed Let's Encrypt certificate and injects `X-Forwarded-Proto: https`.
3. Blitz.cloud forwards the request to your `barber-nginx` container on port 80.
4. Nginx inspects the route:
   - If the request is for `/` or frontend pages, Nginx proxies it to the Frontend container.
   - If the request starts with `/api/`, Nginx proxies it to `http://backend:8080/api/`.
   - If the request starts with `/signin-google`, Nginx proxies it to `http://backend:8080/signin-google` (Google OAuth callback).
   - If the request starts with `/files/`, Nginx proxies it to `http://backend:8080/files/`.
   - If the request starts with `/swagger/`, Nginx proxies it to `http://backend:8080/swagger/`.
   - If the request is `/health`, Nginx proxies it to `http://backend:8080/health`.

This completely eliminates CORS issues because the browser interacts with the exact same domain for both frontend and backend.

## 4. The Certificate & SSL Flow (Managed Edge HTTPS)
On Blitz.cloud, SSL management is fully automated at the edge:
- Blitz.cloud provisions and renews valid Let's Encrypt certificates automatically for `barber.devs.surf` and any `*.blitz.cloud` subdomains.
- No in-container Certbot loops, manual scripts (`init-letsencrypt.sh`), or local certificate files are required.
- Nginx starts instantly on port 80 without any chicken-and-egg startup dependency.

## 5. Startup & Dependency Flow
When Docker starts the project:
1. `db` (PostgreSQL) and `redis` boot up first.
2. PostgreSQL runs a healthcheck (`pg_isready -U postgres -d project1`).
3. `backend` waits for `db` to be healthy before starting.
4. On startup, `backend` automatically applies pending EF Core migrations (`context.Database.MigrateAsync()`) and seeds default roles and admin data.
5. `frontend` starts up.
6. `nginx` starts up once `backend` and `frontend` are ready, beginning to accept traffic on port 80.

## 6. Frontend Base URL & Same-Origin Routing
- In `FrontEnd/src/api/axiosInstance.ts`, the API base URL is:
  `baseURL: import.meta.env.VITE_API_BASE_URL || '/api'`
- In production, it defaults to `/api`.
- Nginx intercepts all `/api` requests and forwards them to `http://backend:8080/api/`.
- This ensures full portability: if the domain changes, no frontend rebuild or environment variable modification is required.
