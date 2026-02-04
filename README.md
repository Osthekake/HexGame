# Hex Game

A hex-based puzzle game built with TypeScript, Three.js, and Vite.

## How to Play

- Use **arrow keys** to move the cursor
- Press **A** to rotate counter-clockwise
- Press **D** to rotate clockwise
- Match 3 or more hexes of the same color to score points
- The timer starts when you first rotate
- Build combos and chains for higher scores!

## Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Open your browser to [http://localhost:5173](http://localhost:5173)

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Docker

Build and run locally:
```bash
docker-compose build && docker-compose up
```

Open [http://localhost/HexGame/](http://localhost/HexGame/)

The container serves the app at the `/HexGame/` path prefix, matching the production URL structure.

## Deployment

This app is deployed as part of [Osthekake.com](https://github.com/Osthekake/Osthekake.com), which manages the reverse proxy and infrastructure for all apps on the site. The HexGame container runs behind the root proxy at `osthekake.com/HexGame/`.

On push to `master`, GitHub Actions builds a Docker image and pushes it to GitHub Container Registry:

```
ghcr.io/osthekake/hexgame:latest
```

To update in production, pull the new image on the server (see the Osthekake.com repo for instructions).

## Project Structure

```
HexGame/
├── src/
│   ├── main.ts          # Entry point
│   ├── grid.ts          # Game grid and logic
│   ├── timer.ts         # Timer and game mechanics
│   ├── keyboard.ts      # Keyboard controls
│   └── highscore.ts     # High score tracking
├── docker/
│   └── nginx.conf       # Nginx config for Docker image
├── Dockerfile           # Multi-stage Docker build
├── docker-compose.yml   # Local Docker testing
├── index.html           # HTML template
├── package.json         # Project dependencies
└── tsconfig.json        # TypeScript configuration
```
