FROM nginx:alpine

# Install apache2-utils and openssl for HTTP basic authentication support
RUN apk add --no-cache apache2-utils openssl

# Copy custom Nginx configuration into container image
COPY nginx.conf /etc/nginx/nginx.conf

# Add script to automatically configure HTTP basic auth for pgAdmin
COPY 40-pgadmin-auth.sh /docker-entrypoint.d/40-pgadmin-auth.sh
RUN chmod +x /docker-entrypoint.d/40-pgadmin-auth.sh

# Expose HTTP port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
