# High-Level Architecture Summary

Here is a complete, high-level summary of your entire production architecture and how everything flows together.

## 1. The Containers (The "Images")
Your application is broken down into 6 isolated containers running inside a private Docker network (`barber-network`):

- **Frontend (`barber-frontend`)**: A lightweight Nginx alpine image that simply serves your built React files.
- **Backend (`barber-api`)**: Your ASP.NET Core API running on a Linux .NET 8 runtime.
- **Database (`barber-sql`)**: Microsoft SQL Server 2022. It saves its data persistently to a Docker volume so data isn't lost when it restarts.
- **Cache (`barber-redis`)**: A Redis container used for fast caching (replacing Upstash).
- **Reverse Proxy (`barber-nginx`)**: The "Main Door" to your application. This is a separate Nginx server that manages all incoming internet traffic.
- **Certificate Manager (`barber-certbot`)**: A background service that talks to Let's Encrypt to get and renew your SSL certificates.

## 2. The Configuration Flow (The `.env` file)
We designed the system so that the `.env` file is the absolute single source of truth for your entire server.

- **The Backend**: In `docker-compose.yml`, we use `env_file: - .env` for the backend. When the backend starts, Docker takes every single variable in that file and injects it as an Environment Variable. Because ASP.NET understands the double underscore (`__`), it automatically overwrites any matching setting in `appsettings.json` (like `JWT__Key` or `Email__Host`).
- **The Database**: Docker reads `DB_PASSWORD` from `.env` and uses it to set the `SA_PASSWORD` when creating the SQL Server.
- **The Frontend**: The frontend is just static HTML/JS files in production, so it does not read the `.env` file. Instead, we designed it to simply make requests to `/api`.

## 3. The Traffic Flow (Nginx)
Because of our strict security rule, Nginx is the ONLY container exposed to the public internet (Ports 80 and 443). The Backend, Database, and Redis are completely hidden inside the Docker network.

When a user visits `https://barber.devs.surf`:
1. The request hits your VPS on port 443.
2. Nginx intercepts the request.
3. If the request is for the main website (e.g., `/` or `/about`), Nginx forwards it internally to the Frontend container.
4. If the request starts with `/api` (e.g., `/api/auth/login`), Nginx forwards it internally to the Backend container (`http://backend:8080/api/`).
5. If the request starts with `/files` (e.g., an uploaded image), Nginx forwards it internally to the Backend container, which serves the image from the local Docker volume.

This completely eliminates CORS issues because, to the user's browser, the frontend and backend appear to be on the exact same server!

## 4. The Certificate & SSL Flow (Nginx + Certbot)
Nginx and Certbot have a "chicken and egg" relationship:
- Nginx refuses to start without an SSL certificate.
- Certbot cannot get an SSL certificate from Let's Encrypt unless Nginx is already running to prove you own the domain.

**The Script (`init-letsencrypt`)**: To solve this, you run the initialization script once. The script dynamically reads your domain and email from the `.env` file. It creates a fake, temporary certificate, uses it to start Nginx, and then asks Certbot to replace the fake certificate with a real, valid one.

**The Automation**: Once it is running, you never have to touch it again.
- The Certbot container runs a loop that wakes up every 12 hours. If your certificate has less than 30 days remaining, it quietly downloads a new one to a shared folder.
- The Nginx container runs a loop that wakes up every 6 hours and reloads its configuration. If a new certificate was downloaded by Certbot, Nginx loads it into memory without dropping any active user connections.

## 5. Dependencies (What depends on what?)
When you run `docker compose up -d`, Docker starts things in a very specific, calculated order:

1. Database & Redis start first.
2. The Database runs a health check every 15 seconds to see if it has finished booting up.
3. The Backend is explicitly configured to wait. It will not start until the Database health check reports "Healthy". This prevents the backend from crashing due to a missing database.
4. The Frontend starts instantly.
5. Nginx is configured to wait. It will not start until both the Backend and Frontend are running, ensuring it doesn't try to route traffic to a container that doesn't exist yet.

## 6. Where does the Frontend get its Base URL?
This is actually the smartest part of the Docker architecture we've set up! The frontend doesn't need to be hardcoded with a domain like `barber.devs.surf` at all. 

Here is exactly how it works: 
- **The Fallback**: Inside `FrontEnd/src/api/axiosInstance.ts`, the code is written as: `baseURL: import.meta.env.VITE_API_BASE_URL || '/api'` 
- **The Build**: Because you are building the frontend inside Docker, we don't pass `VITE_API_BASE_URL`. So the frontend automatically falls back to just using `'/api'`. 
- **The Magic (Nginx)**: When a user visits your site and their browser tries to login, the frontend sends the network request to `barber.devs.surf/api/auth/login`. Nginx sits in front of everything. It intercepts that request, sees the `/api` at the beginning, and instantly says: *"Ah, this is meant for the backend!"* and forwards it internally directly to `http://backend:8080`. 

**Why this is great**: You never have to deal with CORS errors again because the browser thinks the frontend and backend are on the exact same domain. If you change your domain name tomorrow, you don't have to rebuild the frontend or change any environment variables. It will just continue working!
