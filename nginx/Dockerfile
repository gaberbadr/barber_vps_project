FROM nginx:alpine

# Copy custom Nginx configuration into container image
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
