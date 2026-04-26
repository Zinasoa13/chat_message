# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine

# Install envsubst (included in gettext package)
RUN apk add --no-cache gettext

WORKDIR /usr/share/nginx/html

# Copy the build output
COPY --from=build /app/dist/z_message/browser .

# Copy a custom nginx configuration to handle Angular routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html =404; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

# Start script to replace env vars and start nginx
CMD ["/bin/sh", "-c", "envsubst < assets/env.template.js > assets/env.js && exec nginx -g 'daemon off;'"]
