# Hex Game

A hex-based puzzle game built with TypeScript, Three.js, and Vite. Includes a Node.js backend for server-validated highscores with a leaderboard.

## How to Play

- Use **arrow keys** to move the cursor
- Press **A** to rotate counter-clockwise
- Press **D** to rotate clockwise
- Match 3 or more hexes of the same color to score points
- The timer starts when you first rotate
- Build combos and chains for higher scores!
- Upload your score to the leaderboard when the game ends

## Project Structure

This is an npm workspaces monorepo:

```
HexGame/
├── packages/
│   ├── client/              # Frontend (Vite + TypeScript + Three.js)
│   │   ├── src/
│   │   │   ├── main.ts      # Entry point, session management
│   │   │   ├── grid.ts      # Game grid, action recording
│   │   │   ├── timer.ts     # Timer mechanics
│   │   │   ├── highscore-ui.ts  # Leaderboard UI
│   │   │   ├── api-client.ts    # Backend API calls
│   │   │   └── ...
│   │   ├── Dockerfile       # nginx image serving the built client
│   │   ├── nginx.conf       # Reverse-proxies /HexGame/api/ to server
│   │   └── vite.config.ts
│   ├── server/              # Backend (Node.js + Express + SQLite)
│   │   ├── src/
│   │   │   ├── index.ts     # Express app entry
│   │   │   ├── routes/      # /api/sessions, /api/scores
│   │   │   ├── db/          # SQLite schema and queries
│   │   │   ├── middleware/  # Rate limiting, error handling
│   │   │   └── validation.ts  # Score replay validation
│   │   └── Dockerfile
│   └── shared/              # Shared game logic (browser + Node)
│       └── src/
│           ├── game-engine.ts  # Pure game logic, seeded RNG
│           ├── replay.ts       # Server-side score validation
│           ├── rng.ts          # Mulberry32 PRNG
│           └── types.ts        # Shared TypeScript types
├── docker-compose.yml       # Local Docker testing
└── package.json             # Workspace root
```

## Development

Install dependencies:
```bash
npm install
```

Start the backend (port 3001):
```bash
npm run dev:server
```

Start the frontend dev server (port 5173, proxies API to backend):
```bash
npm run dev:client
```

Run tests:
```bash
npm test
```

Build for production:
```bash
npm run build
```

## Docker

Build and run locally:
```bash
docker compose build && docker compose up
```

Open [http://localhost/HexGame/](http://localhost/HexGame/)

This runs two containers:
- **client** (port 80): nginx serving the built frontend, proxying `/HexGame/api/` to the server
- **server** (port 3001): Node.js backend with SQLite database persisted in a Docker volume

## Deployment

This app is deployed as part of [Osthekake.com](https://github.com/Osthekake/Osthekake.com), which manages the reverse proxy and infrastructure. The HexGame containers run behind the root proxy at `osthekake.com/HexGame/`.

On push to `master`, GitHub Actions builds and pushes two Docker images to GitHub Container Registry:

```
ghcr.io/osthekake/hexgame-client:latest
ghcr.io/osthekake/hexgame-server:latest
```

To update in production, pull the new images on the server (see the Osthekake.com repo for instructions).
