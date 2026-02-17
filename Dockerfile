# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app
# Copy shared module source
COPY src/shared/ ./src/shared/
# Copy server source and install deps
COPY server/ ./server/
RUN cd server && npm ci && npm run build

# Stage 3: Runtime (node + nginx)
FROM node:20-alpine

# Install nginx
RUN apk add --no-cache nginx

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Copy frontend build
COPY --from=frontend-builder /app/dist /usr/share/nginx/html/HexGame

# Copy server build + dependencies
COPY --from=server-builder /app/server/dist /app/server/dist
COPY --from=server-builder /app/server/node_modules /app/server/node_modules
COPY --from=server-builder /app/server/package.json /app/server/

# Create data directory for SQLite
RUN mkdir -p /app/data

# Startup script
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
