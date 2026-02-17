# Step 1: Backend Server, Database, API, Docker

**Execute this step SECOND** (after Step 3, before Step 2).

## Context

HexGame is a hex-matching puzzle game that currently runs as a pure frontend app (Vite + TypeScript). Step 3 extracted the game logic into a shared module (`src/shared/`) that runs in both browser and Node.js. This step creates a backend server that uses that shared module to validate scores, store highscores, manage game sessions, and serve everything in Docker.

## What This Step Depends On (from Step 3)

Step 3 must be completed first. It provides:

- **`src/shared/game-engine.ts`**: `GameEngine` class - pure synchronous game engine
- **`src/shared/replay.ts`**: `replayGame(config, seed, actions, claimedScore)` → `{ valid, calculatedScore, reason? }`
- **`src/shared/types.ts`**: Shared types including `GameAction`, `ActionType`, `EngineConfig`, `ReplayResult`
- **`src/shared/rng.ts`**: `SeededRNG` class
- **`src/shared/unique.ts`**: `unique()` utility
- **`src/shared/index.ts`**: Barrel export

The backend imports `replayGame` from the shared module to validate submitted scores.

## What This Step Produces (for Step 2)

- **API endpoints** that the frontend (Step 2) calls:
  - `POST /api/sessions` → creates game session, returns seed + detected country
  - `GET /api/scores` → fetches leaderboard (top 10 + around-player context)
  - `POST /api/scores` → validates and stores a score
- **Updated Docker setup** that serves both frontend and backend
- **Dev proxy** in Vite config so the frontend dev server can reach the backend

---

## Current Infrastructure

### `Dockerfile` (current)
Multi-stage: node:20-alpine builds frontend → nginx:alpine serves static files at `/HexGame/`.

### `docker-compose.yml` (current)
```yaml
services:
  hexgame:
    build: .
    ports:
      - "80:80"
```

### `docker/nginx.conf` (current)
Serves static files at `/HexGame/` with gzip and SPA fallback.

### `vite.config.ts` (current)
```typescript
import { defineConfig } from 'vite'
export default defineConfig({
  base: '/HexGame/',
  server: { host: true }
})
```

### `.github/workflows/deploy.yml` (current)
Builds Docker image and pushes to `ghcr.io/osthekake/hexgame:latest` on master push.

---

## Implementation Plan

### 1. Create `server/package.json`

```json
{
  "name": "hexgame-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.0.0",
    "geoip-lite": "^1.4.10"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/better-sqlite3": "^7.6.8",
    "@types/geoip-lite": "^1.1.34",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3"
  }
}
```

### 2. Create `server/tsconfig.json`

The server needs to compile both its own code and the shared module from `src/shared/`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "../src/shared/**/*"]
}
```

The `rootDir: ".."` and `include` paths ensure that `../src/shared/` is compiled into `dist/src/shared/` and server code into `dist/server/src/`. Imports in server code use relative paths like `../../../src/shared/replay.js`.

**Alternative approach**: If the relative path import is awkward, use a simpler setup where the server build script copies `src/shared/` into `server/src/shared/` before compiling. Pick whichever approach works cleanly.

### 3. Create `server/src/db/schema.ts`

Initialize SQLite database with schema:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  used BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
  nickname TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  actions TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at);
CREATE INDEX IF NOT EXISTS idx_scores_country ON scores(country);
```

The function should:
- Accept a database file path (default `./data/hexgame.db`)
- Create the data directory if it doesn't exist
- Open the database with better-sqlite3
- Run the CREATE TABLE/INDEX statements
- Enable WAL mode for better concurrent read performance
- Return the database instance

### 4. Create `server/src/db/queries.ts`

Prepared statements for all database operations:

**Session queries:**
- `createSession(id, seed, ipAddress)` → INSERT into sessions
- `getSession(id)` → SELECT from sessions WHERE id = ?
- `markSessionUsed(id)` → UPDATE sessions SET used = 1 WHERE id = ?

**Score queries:**
- `insertScore(sessionId, nickname, country, score, actions)` → INSERT into scores
- `getTopScores(limit, whereClause?, params?)` → SELECT with ROW_NUMBER()
- `getScoreRank(score, whereClause?, params?)` → COUNT where score > ?
- `getScoresAround(offset, limit, whereClause?, params?)` → SELECT with LIMIT/OFFSET

Use better-sqlite3's synchronous API with prepared statements for performance.

### 5. Create `server/src/middleware/rate-limit.ts`

Simple in-memory rate limiter:
- Track last submission timestamp per IP
- Reject if less than 30 seconds since last submission
- Clean up old entries periodically (every 5 minutes)
- Returns 429 Too Many Requests when rate limited

### 6. Create `server/src/middleware/error-handler.ts`

Express error handler middleware:
- Log errors to console
- Return 500 with generic error message in production
- Return 500 with error details in development

### 7. Create `server/src/validation.ts`

Wraps the shared `replayGame()` function with the game config:

```typescript
import { replayGame } from '../../src/shared/replay';
import type { GameAction, EngineConfig } from '../../src/shared/types';

const GAME_CONFIG: EngineConfig = {
  gridWidth: 7,
  gridHeight: 7,
  numberOfColors: 10,
  timerMax: 30000,
  animationTimes: {
    rotate: 400,
    vanish: 400,
    shift: 400,
    text: 600
  }
};

export function validateScore(seed: number, actions: GameAction[], claimedScore: number) {
  return replayGame(GAME_CONFIG, seed, actions, claimedScore);
}
```

### 8. Create `server/src/routes/sessions.ts`

**POST /api/sessions**

```typescript
import { Router } from 'express';
import { randomUUID, randomInt } from 'crypto';
import geoip from 'geoip-lite';

export function sessionRoutes(db) {
  const router = Router();

  router.post('/', (req, res) => {
    const sessionId = randomUUID();
    const seed = randomInt(0, 2 ** 32);
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
    const ipStr = Array.isArray(ip) ? ip[0] : ip;

    // Auto-detect country from IP
    const geo = geoip.lookup(ipStr);
    const country = geo?.country || '';  // ISO 3166-1 alpha-2

    db.prepare('INSERT INTO sessions (id, seed, ip_address) VALUES (?, ?, ?)')
      .run(sessionId, seed, ipStr);

    res.json({ sessionId, seed, country });
  });

  return router;
}
```

### 9. Create `server/src/routes/scores.ts`

**GET /api/scores**

Query parameters:
- `variant`: `"alltime"` | `"today"` | `"region"` (default: `"alltime"`)
- `country`: ISO 3166-1 alpha-2 (required when variant=region)
- `referenceScore`: integer (optional, for around-player context)

Response:
```json
{
  "top10": [
    { "rank": 1, "nickname": "Alice", "country": "NO", "score": 5000, "createdAt": "2026-02-17T12:00:00Z" }
  ],
  "around": [
    { "rank": 45, "nickname": "Bob", "country": "SE", "score": 1200, "createdAt": "2026-02-17T10:00:00Z" }
  ]
}
```

Logic:
1. Build WHERE clause based on variant:
   - `alltime`: no filter
   - `today`: `WHERE date(created_at) = date('now')`
   - `region`: `WHERE country = ?`
2. Fetch top 10 with `ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC)`
3. If `referenceScore` provided:
   a. Compute rank of the reference score
   b. If rank > 10: fetch 11 rows starting 5 positions above the reference rank
   c. If rank <= 10: around is empty (already in top 10)

**POST /api/scores**

Request body:
```json
{
  "sessionId": "uuid-string",
  "nickname": "PlayerName",
  "score": 5000,
  "actions": [
    { "type": "moveRight", "timestamp": 0 },
    { "type": "rotateClockwise", "timestamp": 150 }
  ]
}
```

Note: country is NOT in the request body - it's auto-detected from IP server-side.

Response (success):
```json
{ "valid": true, "rank": 42 }
```

Response (validation failure, HTTP 400):
```json
{ "valid": false, "reason": "Score mismatch: claimed 5000, calculated 4800" }
```

Response (session already used, HTTP 409):
```json
{ "error": "Session already used" }
```

Validation chain:
1. Check `sessionId` exists in DB and `used = 0`
2. Validate `nickname`: string, 1-20 chars, trimmed, no HTML/script tags
3. Validate `score`: positive integer
4. Validate `actions`: non-empty array, each has valid `type` and numeric `timestamp`
5. Call `validateScore(session.seed, actions, score)` from `validation.ts`
6. If valid: wrap in transaction → mark session used + insert score (with auto-detected country from IP)
7. Compute rank and return

### 10. Create `server/src/index.ts`

Express app entry point:

```typescript
import express from 'express';
import { initDB } from './db/schema';
import { sessionRoutes } from './routes/sessions';
import { scoreRoutes } from './routes/scores';
import { errorHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Trust proxy for correct IP detection behind nginx
app.set('trust proxy', true);

const db = initDB(process.env.DB_PATH || './data/hexgame.db');

app.use('/api/sessions', sessionRoutes(db));
app.use('/api/scores', rateLimit, scoreRoutes(db));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HexGame server listening on port ${PORT}`);
});
```

### 11. Update `docker/nginx.conf`

Add API proxy block before the static files block:

```nginx
server {
    listen 80;
    listen [::]:80;
    root /usr/share/nginx/html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    # Proxy API requests to Node.js backend
    location /HexGame/api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /HexGame/ {
        try_files $uri $uri/ /HexGame/index.html;
    }
}
```

### 12. Update `Dockerfile`

Multi-stage build for frontend + backend + runtime:

```dockerfile
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
```

Note: The nginx config path may be `/etc/nginx/http.d/default.conf` or `/etc/nginx/conf.d/default.conf` depending on the alpine nginx version. Check which one the base image uses. The current Dockerfile uses `COPY docker/nginx.conf /etc/nginx/conf.d/default.conf`.

### 13. Create `docker/start.sh`

```bash
#!/bin/sh
set -e

# Start the Node.js backend in background
cd /app/server
DB_PATH=/app/data/hexgame.db node dist/server/src/index.js &

# Start nginx in foreground
nginx -g 'daemon off;'
```

The exact path to the compiled server entry point depends on how tsconfig resolves. It will be something like `dist/server/src/index.js` (since rootDir is `..` which maps `server/src/` to `dist/server/src/`). Verify the actual output path after building.

### 14. Update `docker-compose.yml`

```yaml
services:
  hexgame:
    build: .
    ports:
      - "80:80"
    volumes:
      - hexgame-data:/app/data

volumes:
  hexgame-data:
```

### 15. Update `vite.config.ts`

Add dev server proxy so the frontend can reach the backend during development:

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/HexGame/',
  server: {
    host: true,
    proxy: {
      '/HexGame/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/HexGame/, ''),
      }
    }
  }
})
```

### 16. Update `.github/workflows/deploy.yml`

The build context already includes the whole repo. The Dockerfile handles everything. The main change is ensuring `server/` directory and `src/shared/` are included in the Docker build context (they are, since the context is `.`).

If the workflow currently only runs `npm ci` and `npm run build` for the frontend, it may need to also install server dependencies. But since the Dockerfile handles all builds internally, the workflow likely just needs to build the Docker image as before.

Review the workflow and ensure it still works with the new multi-stage Dockerfile.

### 17. Add `.dockerignore` entries

Make sure `server/node_modules` and `server/dist` are not copied into the build context (they'd be rebuilt inside Docker):

```
server/node_modules
server/dist
data/
```

---

## API Contract Summary

### POST /api/sessions
- Request: `{}` (empty body)
- Response: `{ sessionId: string, seed: number, country: string }`
- Country is auto-detected from IP via geoip-lite

### GET /api/scores
- Query: `variant=alltime|today|region`, `country=XX` (for region), `referenceScore=N` (optional)
- Response: `{ top10: ScoreEntry[], around: ScoreEntry[] }`
- ScoreEntry: `{ rank: number, nickname: string, country: string, score: number, createdAt: string }`

### POST /api/scores
- Request: `{ sessionId: string, nickname: string, score: number, actions: GameAction[] }`
- Success: `{ valid: true, rank: number }`
- Failure: `{ valid: false, reason: string }` (HTTP 400)
- Session used: `{ error: "Session already used" }` (HTTP 409)
- Rate limited: HTTP 429

---

## Local Development

After completing this step, you should be able to:

1. **Start backend**: `cd server && npm install && npm run dev`
   - Server runs on port 3001
   - SQLite DB created at `./data/hexgame.db`

2. **Start frontend**: `npm run dev`
   - Vite dev server on port 5173
   - API calls proxied to localhost:3001

3. **Docker**: `docker-compose up --build`
   - Single container serves frontend (nginx) + backend (Node.js) on port 80

---

## Verification

1. **Server starts**: `cd server && npm run dev` → no errors, listening on 3001
2. **Create session**: `curl -X POST http://localhost:3001/api/sessions` → returns `{ sessionId, seed, country }`
3. **Submit invalid score**: `curl -X POST http://localhost:3001/api/scores -H 'Content-Type: application/json' -d '{"sessionId":"<id>","nickname":"test","score":9999,"actions":[{"type":"rotateClockwise","timestamp":0}]}'` → returns `{ valid: false, reason: "Score mismatch..." }`
4. **Fetch scores**: `curl http://localhost:3001/api/scores?variant=alltime` → returns `{ top10: [], around: [] }`
5. **Docker build**: `docker-compose up --build` → both services start, accessible on port 80
6. **API through nginx**: `curl http://localhost/HexGame/api/sessions -X POST` → proxied to backend correctly

---

## File Summary

### New Files
| File | Description |
|------|-------------|
| `server/package.json` | Server dependencies and scripts |
| `server/tsconfig.json` | TypeScript config (includes shared module) |
| `server/src/index.ts` | Express app entry point |
| `server/src/routes/sessions.ts` | POST /api/sessions |
| `server/src/routes/scores.ts` | GET & POST /api/scores |
| `server/src/db/schema.ts` | SQLite schema initialization |
| `server/src/db/queries.ts` | Prepared statements |
| `server/src/middleware/error-handler.ts` | Error handler |
| `server/src/middleware/rate-limit.ts` | Rate limiter |
| `server/src/validation.ts` | Score validation wrapper |
| `docker/start.sh` | Startup script for Docker |

### Modified Files
| File | Changes |
|------|---------|
| `docker/nginx.conf` | Add /HexGame/api/ proxy to backend |
| `Dockerfile` | Multi-stage: frontend + server + runtime (node+nginx) |
| `docker-compose.yml` | Add volume for SQLite persistence |
| `vite.config.ts` | Add dev proxy for /HexGame/api |
| `.github/workflows/deploy.yml` | Review/update for new Dockerfile |
| `.dockerignore` | Add server/node_modules, server/dist, data/ |
