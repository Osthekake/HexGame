FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests (all three needed for npm ci to resolve workspace deps)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm ci

# Copy source for shared and server
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

# esbuild bundles shared + server into a single dist/index.js
RUN npm run build -w @hexgame/server

# Production deps: install only what's needed at runtime
# (better-sqlite3 and geoip-lite are external to the bundle)
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN mkdir -p packages/shared packages/server packages/client
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./dist
RUN mkdir -p /data
EXPOSE 3001
ENV DB_PATH=/data/hexgame.db
CMD ["node", "dist/index.js"]
