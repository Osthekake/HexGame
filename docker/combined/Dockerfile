# Combined Dockerfile for client + server
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests (all three needed for npm ci to resolve workspace deps)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build shared + client + server
RUN npm run build -w @hexgame/client
RUN npm run build -w @hexgame/server

# Production stage - base with Node.js
FROM node:20-alpine

WORKDIR /app

# Install nginx and supervisor
RUN apk add --no-cache nginx supervisor && \
    mkdir -p /var/log/nginx /var/cache/nginx /var/lib/nginx /run/nginx

# Install production dependencies for server
# (better-sqlite3 and geoip-lite are native and excluded from the bundle)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN mkdir -p packages/shared packages/client
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server bundle
COPY --from=builder /app/packages/server/dist ./dist

# Copy built client files
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html/HexGame

# Copy nginx main configuration
COPY docker/combined/nginx.conf /etc/nginx/nginx.conf

# Copy nginx server configuration
COPY docker/combined/nginx-server.conf /etc/nginx/conf.d/default.conf

# Copy supervisor config
COPY docker/combined/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create directories for supervisor logs and data
RUN mkdir -p /var/log/supervisor /var/run /data

# Expose port
EXPOSE 80

ENV DB_PATH=/data/hexgame.db

# Start supervisor which manages both nginx and node
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
