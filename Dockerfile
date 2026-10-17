# ==============================================================================
# Production Dockerfile for Barber Management System (Blitz.cloud / Docker)
# Multi-stage build combining React SPA frontend and ASP.NET Core 8 Web API
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend React SPA with Vite
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Install dependencies first for better layer caching
COPY FrontEnd/package*.json ./
RUN npm ci

# Copy frontend source and build static bundle
COPY FrontEnd/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build ASP.NET Core 8 Backend API
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-builder
WORKDIR /src

# Copy project files in dependency order for optimal cache reuse
COPY Backend/Domain/*.csproj ./Domain/
COPY Backend/Application/*.csproj ./Application/
COPY Backend/Infrastructure/*.csproj ./Infrastructure/
COPY Backend/API/*.csproj ./API/

# Restore dependencies
WORKDIR /src/API
RUN dotnet restore

# Copy remaining source code and publish release build
WORKDIR /src
COPY Backend/ .
WORKDIR /src/API
RUN dotnet build -c Release --no-restore
RUN dotnet publish -c Release -o /app/publish --no-build

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for health monitoring
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy backend published binaries
COPY --from=backend-builder /app/publish .

# Copy frontend static build into wwwroot
# ASP.NET Core serves the React SPA at root / with fallback routing for HTML5 client routes
COPY --from=frontend-builder /frontend/dist ./wwwroot

# Create uploads directory with appropriate permissions
RUN mkdir -p /app/wwwroot/files && \
    chmod -R 755 /app/wwwroot && \
    chmod -R 777 /app/wwwroot/files

# Configure environment defaults
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_HTTPS_PORT=443
ENV PORT=8080

# Expose HTTP port for Blitz.cloud edge reverse proxy
EXPOSE 8080

# Health check verifies the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "API.dll"]
