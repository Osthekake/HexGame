# Hex Game

A hex-based puzzle game built with TypeScript and Vite.

## Getting Started

### Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Open your browser to [http://localhost:5173](http://localhost:5173)

### Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## How to Play

- Use **arrow keys** to move the cursor
- Press **A** to rotate counter-clockwise
- Press **D** to rotate clockwise
- Match 3 or more hexes of the same color to score points
- The timer starts when you first rotate
- Build combos and chains for higher scores!

## Project Structure

```
HexGame/
├── src/
│   ├── main.ts          # Entry point
│   ├── grid.ts          # Game grid and logic
│   ├── timer.ts         # Timer and game mechanics
│   ├── animation.ts     # Animation system
│   ├── keyboard.ts      # Keyboard controls
│   └── highscore.ts     # High score tracking
├── index.html           # HTML template
├── package.json         # Project dependencies
└── tsconfig.json        # TypeScript configuration
```

## Modernization Changes

This project has been modernized from the original version with:

- **TypeScript** - Full type safety and better developer experience
- **Vite** - Fast development server and optimized builds
- **ES Modules** - Modern import/export syntax
- **npm** - Package management and scripts
- **Class-based architecture** - Proper OOP with dependency injection, no singletons
- **Promises & async/await** - Modern asynchronous programming, no callbacks
- **Utility functions** - Pure functions extracted into separate utils module

### Original Files

The original JavaScript files are preserved in the root directory:
- `main.html` (original)
- `Grid.js` (original)
- `Timer.js` (original)
- `animation.js` (original)
- `Keyboard.js` (original)
- `highscore.js` (original)

The modernized TypeScript versions are in the `src/` directory.
