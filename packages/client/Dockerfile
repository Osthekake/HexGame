FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests (all three needed for npm ci to resolve workspace deps)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/
RUN npm ci

# Copy source for shared and client
COPY packages/shared/ ./packages/shared/
COPY packages/client/ ./packages/client/

RUN npm run build -w @hexgame/client

FROM nginx:alpine
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html/HexGame
EXPOSE 80
