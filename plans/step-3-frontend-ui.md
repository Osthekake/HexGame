# Step 2: Frontend UI for Highscores

**Execute this step LAST** (after Step 3 and Step 1).

## Context

HexGame is a hex-matching puzzle game built with vanilla TypeScript + Vite (no React/Vue). Step 3 refactored the game logic into a shared module with seeded RNG and action recording. Step 1 created a backend server with session management, score validation, and leaderboard API. This step builds the frontend UI to tie everything together: viewing highscores, entering nicknames, and uploading validated scores.

## What This Step Depends On

### From Step 3 (shared game logic)
- `src/grid.ts` now accepts a `seed` parameter in its constructor
- `src/grid.ts` has `getActions(): GameAction[]` to retrieve recorded player actions
- `src/grid.ts` has `getScore(): number` to retrieve the current score
- `src/shared/types.ts` exports `GameAction` type

### From Step 1 (backend)
The backend runs on port 3001 (dev) or behind nginx (Docker) and provides:

**POST /api/sessions** → `{ sessionId: string, seed: number, country: string }`
- Creates game session, returns seed for RNG and auto-detected country from IP

**GET /api/scores?variant=alltime|today|region&country=XX&referenceScore=N**
- Returns `{ top10: ScoreEntry[], around: ScoreEntry[] }`
- `ScoreEntry`: `{ rank: number, nickname: string, country: string, score: number, createdAt: string }`
- `top10`: top 10 scores for the selected variant
- `around`: 5 above + 5 below the referenceScore (empty if in top 10 or not provided)

**POST /api/scores** → `{ valid: boolean, rank?: number, reason?: string }`
- Request: `{ sessionId: string, nickname: string, score: number, actions: GameAction[] }`
- Country auto-detected server-side (not sent by client)
- HTTP 400 if validation fails, HTTP 409 if session already used

**Vite dev proxy** (from Step 1): `/HexGame/api` → `http://localhost:3001/api`

---

## Current Frontend Architecture

### `index.html`
Minimal HTML structure:
- `.score-container` (fixed top) → score display with `#points` span
- `.content` (horizontal flex) → `#canvas-container` + `#time` (timer bar)
- `.settings-container` (fixed top-right) → gear button + dropdown menu
- `.overlay-container` (fixed overlay) → instruction text, game-over text, restart button
- Script: `<script type="module" src="/src/main.ts"></script>`

### `src/main.ts` (300 lines)
Game lifecycle manager:
- Gets DOM elements by ID/class
- Creates persistent instances: `Bar`, `Timer` (30s/1s), `HighScore`, `WakeLockManager`
- `initializeGame(rendererType)`: creates canvas, renderer, Grid, input handler, sets callbacks
- `grid.onGameStart`: hides overlay, requests wake lock, tracks analytics
- `grid.onGameOver`: shows game-over UI, releases wake lock, tracks analytics
- Restart: resets timer, calls `grid.init()`, shows start UI
- Settings menu: switches renderer/input type

Key DOM manipulation functions:
- `showGameOverUI()`: hides instruction, shows "Game Over" + restart button
- `showStartUI()`: shows instruction, hides game-over elements
- `hideOverlay()`: hides all overlay text

### `src/grid.ts` (after Step 3)
- Constructor now takes `seed: number` parameter
- Has `getActions(): GameAction[]` and `getScore(): number`
- Everything else about the Grid API is unchanged

### `src/highscore.ts` (to be removed)
Current localStorage-only highscore:
- `HighScore` class with `enter(score)`, `clear()`, `render()`
- Uses `config.highscoreEnabled` flag
- Referenced in `main.ts` (line 63) and `grid.ts` (line 62)

### `src/config.ts`
- `GameConfig` type with `highscoreEnabled: boolean`
- Colors loaded from CSS variables
- Renderer/input persistence in localStorage

### `src/main.css`
- Flexbox layout, fixed overlays, responsive breakpoints at 768px and 480px
- Button styles using CSS variables (--button-border-color, --button-background-color, etc.)
- Score container fixed at top, pointer-events: none (children auto)

### `src/colors.css`
- CSS variables for theme: timer, cursor, background, button styles
- Renderer-specific tile colors (body.renderer-canvas2d, body.renderer-threejs)
- Text colors differ by renderer (dark for canvas2d, light for threejs)

---

## Implementation Plan

### 1. Create `src/api-client.ts`

HTTP client wrapping fetch calls to the backend:

```typescript
const API_BASE = `${window.location.origin}/HexGame/api`;

export interface SessionResponse {
  sessionId: string;
  seed: number;
  country: string;  // auto-detected from IP
}

export interface ScoreEntry {
  rank: number;
  nickname: string;
  country: string;
  score: number;
  createdAt: string;
}

export interface ScoresResponse {
  top10: ScoreEntry[];
  around: ScoreEntry[];
}

export interface SubmitScoreResponse {
  valid: boolean;
  rank?: number;
  reason?: string;
  error?: string;
}

export async function createSession(): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function getScores(
  variant: 'alltime' | 'today' | 'region',
  referenceScore?: number,
  country?: string
): Promise<ScoresResponse> {
  const params = new URLSearchParams({ variant });
  if (referenceScore !== undefined) params.set('referenceScore', String(referenceScore));
  if (country) params.set('country', country);
  const res = await fetch(`${API_BASE}/scores?${params}`);
  if (!res.ok) throw new Error('Failed to fetch scores');
  return res.json();
}

export async function submitScore(data: {
  sessionId: string;
  nickname: string;
  score: number;
  actions: GameAction[];
}): Promise<SubmitScoreResponse> {
  const res = await fetch(`${API_BASE}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}
```

### 2. Create `src/nickname-store.ts`

Simple localStorage wrapper for the player's nickname:

```typescript
const NICKNAME_KEY = 'hexgame_nickname';

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) || '';
}

export function setNickname(name: string): void {
  localStorage.setItem(NICKNAME_KEY, name);
}
```

### 3. Create `src/highscore-ui.ts`

The main UI component. This is vanilla TypeScript with direct DOM manipulation (matching the project's existing patterns - no framework).

The component manages two views:

**A. Score Upload Prompt** (shown at game over when score > 100):
- Displays the player's score prominently
- Nickname text input (pre-filled from localStorage if available, editable)
- "Upload Score" button
- "Skip" button to dismiss
- Status text area for: "Uploading...", "Score uploaded! Rank: #42", "Score rejected: ...", "Network error"
- On successful upload: save nickname to localStorage, then switch to the board view after a short delay

**B. Highscore Board** (accessible via trophy button anytime):
- 3 tab buttons: "All Time" (default), "Today", "My Region"
- Active tab highlighted with CSS
- Score table: # | Name | Country | Score
- Top 10 section
- Separator ("...") if around-player rows exist
- Around-player section (5 above, player's area, 5 below)
- Loading state: "Loading..."
- Error state: "Failed to load scores"
- Close button (X) in top-right of panel

**Implementation approach:**
- Create the DOM elements programmatically in the constructor (or reference pre-existing HTML elements by ID)
- Use event delegation where possible
- HTML escape all user-provided text (nicknames) before inserting into DOM
- Use CSS classes from the project's existing variable system

```typescript
export class HighscoreUI {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private boardView: HTMLElement;
  private uploadView: HTMLElement;
  private currentVariant: 'alltime' | 'today' | 'region' = 'alltime';
  private playerCountry: string = '';
  private lastScore: number = 0;
  private lastActions: GameAction[] = [];
  private lastSessionId: string = '';

  constructor() {
    // Get or create DOM elements
    // Set up event listeners
  }

  setPlayerCountry(country: string): void {
    this.playerCountry = country;
  }

  showUploadPrompt(score: number, actions: GameAction[], sessionId: string): void {
    // Pre-fill nickname from localStorage
    // Show score
    // Show the upload prompt view
    // Hide the board view
    // Show the overlay
  }

  async showBoard(): Promise<void> {
    // Hide upload view
    // Show board view
    // Show overlay
    // Load scores for current variant
  }

  hide(): void {
    // Hide overlay
  }

  private async handleUpload(): Promise<void> {
    // Validate nickname (non-empty)
    // Save nickname to localStorage
    // Disable upload button
    // Show "Uploading..."
    // Call submitScore()
    // Handle response: success → show rank, switch to board; failure → show reason
  }

  private async switchTab(variant: 'alltime' | 'today' | 'region'): Promise<void> {
    // Update active tab styling
    // Load scores for new variant
  }

  private async loadScores(): Promise<void> {
    // Show loading state
    // Call getScores() with current variant, referenceScore, country
    // Render the score table
  }

  private renderScoreTable(top10: ScoreEntry[], around: ScoreEntry[]): string {
    // Generate HTML table with rank, nickname (escaped), country, score
    // Add separator and around rows if present
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

### 4. Add HTML to `index.html`

Add these elements inside `<body>`, after the existing overlay-container:

**Trophy/Highscore button** (positioned in the top area):
```html
<button class="button highscore-button" id="highscore-button">&#127942;</button>
```

**Highscore overlay** (full-screen modal):
```html
<div class="highscore-overlay" id="highscore-overlay" style="display: none;">
  <div class="highscore-panel">
    <button class="highscore-close-btn" id="close-highscore-btn">&times;</button>

    <!-- Upload Prompt View -->
    <div id="upload-prompt" style="display: none;">
      <h2 class="highscore-title">New Score!</h2>
      <p class="highscore-score-display">Score: <span id="upload-score-display"></span></p>
      <div class="highscore-form-group">
        <label for="nickname-input">Nickname</label>
        <input type="text" id="nickname-input" maxlength="20" placeholder="Enter nickname" autocomplete="off" />
      </div>
      <div class="highscore-form-actions">
        <button class="button" id="upload-score-btn">Upload Score</button>
        <button class="button highscore-secondary-btn" id="skip-upload-btn">Skip</button>
      </div>
      <p id="upload-status" class="highscore-status"></p>
    </div>

    <!-- Highscore Board View -->
    <div id="highscore-board" style="display: none;">
      <div class="highscore-tabs">
        <button class="highscore-tab active" id="tab-alltime">All Time</button>
        <button class="highscore-tab" id="tab-today">Today</button>
        <button class="highscore-tab" id="tab-region">My Region</button>
      </div>
      <div id="highscore-list"></div>
    </div>
  </div>
</div>
```

### 5. Add CSS to `src/main.css`

Add styles using the existing CSS variable system. Key styles:

```css
/* Trophy button - positioned top-left */
.highscore-button {
  position: fixed;
  top: 2em;
  left: 2em;
  z-index: 10;
  font-size: var(--text-size-lg);
  padding: 0.5em 0.75em;
}

/* Overlay - full screen semi-transparent backdrop */
.highscore-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

/* Panel - centered card */
.highscore-panel {
  background: var(--button-background-color);
  border: 2px solid var(--button-border-color);
  border-radius: 1em;
  padding: 2em;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  color: var(--button-text-color);
  font-family: var(--text-font-family);
}

/* Close button */
.highscore-close-btn { ... }

/* Tabs */
.highscore-tabs { display: flex; gap: 0.5em; margin-bottom: 1em; }
.highscore-tab { flex: 1; ... }
.highscore-tab.active { background: var(--button-background-hover-color); }

/* Score table */
.highscore-table { width: 100%; border-collapse: collapse; }
.highscore-table th, .highscore-table td { padding: 0.5em; text-align: left; }
.highscore-table .highlighted { background: var(--button-background-hover-color); font-weight: bold; }
.highscore-table .separator td { text-align: center; opacity: 0.5; }

/* Upload form */
.highscore-form-group { margin: 1em 0; }
.highscore-form-group input { width: 100%; padding: 0.5em; box-sizing: border-box; ... }
.highscore-form-actions { display: flex; gap: 1em; }
.highscore-secondary-btn { background: transparent; }

/* Status messages */
.highscore-status { margin-top: 0.5em; font-size: var(--text-size-sm); }
.highscore-status.error { color: #ff6b6b; }
.highscore-status.success { color: #51cf66; }

/* Mobile */
@media (max-width: 768px) {
  .highscore-button { top: 1em; left: 1em; font-size: var(--text-size-md); }
  .highscore-panel { padding: 1em; max-height: 90vh; }
}
```

Use class prefixes (`highscore-`) to avoid conflicts with existing styles.

### 6. Modify `src/main.ts`

This is the most significant modification. Changes needed:

**A. Import new modules:**
```typescript
import { createSession, type SessionResponse } from './api-client';
import { HighscoreUI } from './highscore-ui';
import type { GameAction } from './shared/types';
```

**B. Remove old highscore:**
- Remove `import { HighScore } from './highscore'`
- Remove `const highScore = new HighScore(config.highscoreEnabled);`
- Remove any references to `highScore` (passed to Grid constructor, clear button handler)
- The Grid constructor in Step 3 should have made the HighScore parameter optional or removed it

**C. Add session state:**
```typescript
let currentSessionId = '';
let currentSeed = 0;
let currentCountry = '';
let isOnline = false;

const highscoreUI = new HighscoreUI();

async function startNewSession(): Promise<void> {
  try {
    const session = await createSession();
    currentSessionId = session.sessionId;
    currentSeed = session.seed;
    currentCountry = session.country;
    highscoreUI.setPlayerCountry(currentCountry);
    isOnline = true;
  } catch (e) {
    // Backend unavailable - use random seed, disable upload
    currentSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    currentSessionId = '';
    currentCountry = '';
    isOnline = false;
    console.warn('Backend unavailable, playing in offline mode');
  }
}
```

**D. Modify `initializeGame()`:**
- Before creating the Grid, ensure we have a session (call `await startNewSession()` if needed)
- Pass `currentSeed` to Grid constructor:
  ```typescript
  grid = new Grid(renderer, pointsElement, timer, config, currentSeed);
  ```
  Note: The Grid constructor signature changed in Step 3 to accept `seed` and no longer needs `highScore`.

**E. Modify game start callback:**
```typescript
grid.onGameStart = () => {
  isGameOver = false;
  hideOverlay();
  wakeLock.request();
  trackGameStart();
};
```

**F. Modify game over callback:**
```typescript
grid.onGameOver = async () => {
  isGameOver = true;
  showGameOverUI();
  wakeLock.release();
  trackGameOver(grid.getScore());

  // Show upload prompt if score > 100 and we have a valid session
  if (grid.getScore() > 100 && isOnline && currentSessionId) {
    highscoreUI.showUploadPrompt(
      grid.getScore(),
      grid.getActions(),
      currentSessionId
    );
  }

  // Pre-fetch a new session for the next game
  await startNewSession();
};
```

**G. Modify restart flow:**
```typescript
restartButton.addEventListener('click', async () => {
  if (isGameOver) {
    isGameOver = false;
    timer.reset();
    // Ensure we have a fresh session
    if (!currentSessionId) {
      await startNewSession();
    }
    grid = new Grid(renderer, pointsElement, timer, config, currentSeed);
    grid.init();
    // Re-attach callbacks and input handler...
    showStartUI();
  }
});
```

Actually, rather than recreating the Grid on restart, it may be cleaner to add a method to Grid that reinitializes with a new seed. Evaluate what's simplest while ensuring each game uses a fresh seed.

**H. Add trophy button handler:**
```typescript
const highscoreButton = document.getElementById('highscore-button');
if (highscoreButton) {
  highscoreButton.addEventListener('click', () => {
    highscoreUI.showBoard();
  });
}
```

**I. Handle initial page load:**
```typescript
// At module level, kick off session creation
startNewSession().then(() => {
  initializeGame(config.renderer);
});
```

Or if you want the game to appear immediately (even before the session is ready), initialize the game with a temporary random seed and replace it when the session arrives.

**J. Remove highscore-related config:**
- Remove references to `config.highscoreEnabled`
- Remove the clear highscore button handler (lines 291-296)

### 7. Remove `src/highscore.ts`

Delete this file entirely. It's replaced by the server-based system.

Also update any imports in `src/grid.ts` that reference the old `HighScore` class. Step 3 may have already removed this dependency, but verify.

### 8. Update `src/config.ts`

Remove `highscoreEnabled` from `GameConfig` type and from the config object creation. If other code references it, remove those references too.

---

## Detailed UI Behavior

### Upload Prompt Flow
1. Game ends with score > 100 and backend is online
2. Upload prompt appears over the game (overlay backdrop)
3. Nickname field pre-filled from localStorage (or empty for first-time players)
4. Player types/edits nickname
5. Player clicks "Upload Score":
   - Button disabled, shows "Uploading..."
   - POST /api/scores called
   - On success: "Score uploaded! Rank: #N" in green, nickname saved to localStorage, auto-switch to board view after 1.5s
   - On failure (400): "Score rejected: <reason>" in red
   - On network error: "Network error. Please try again." in red, button re-enabled
6. Player clicks "Skip": overlay closes, back to game-over screen with restart button

### Highscore Board Flow
1. Player clicks trophy button (or auto-shown after successful upload)
2. Board appears with "All Time" tab active
3. Scores load from server, displayed in table
4. Player clicks tab → tab highlights, scores reload for that variant
5. "My Region" tab passes the player's detected country to the API
6. If player has a recent score, the "around" section shows their neighborhood
7. Player clicks X → overlay closes

### Offline Behavior
- If `createSession()` fails → `isOnline = false`
- Game works normally with a random (non-server) seed
- Upload prompt does NOT appear at game over
- Trophy button: either hidden or shows "Scores unavailable" when clicked
- No crash, no error dialogs - graceful degradation

---

## Verification

After completing this step, test the full flow:

1. **Start backend**: `cd server && npm run dev`
2. **Start frontend**: `npm run dev`
3. **Play a game**: Verify tiles appear, scoring works, timer works
4. **Score > 100**: Game over → upload prompt appears with nickname input
5. **Upload**: Enter nickname, click Upload → "Score uploaded! Rank: #1"
6. **Board auto-shows**: Leaderboard with your score in the table
7. **Tabs work**: Switch between All Time / Today / My Region
8. **Trophy button**: Click trophy anytime → board opens
9. **Restart**: Click restart → new game with fresh seed
10. **Offline mode**: Stop backend, refresh page → game works, no upload prompt
11. **Docker**: `docker-compose up --build` → everything works on port 80

### Edge Cases to Test
- Score exactly 100: no upload prompt (must be > 100)
- Score 0: no upload prompt
- Empty nickname: shows "Please enter a nickname" error
- Very long nickname (20 chars): accepted, truncated at maxlength
- Submit same session twice: "Session already used" error
- Network drops during upload: "Network error" shown
- Multiple games: each gets a fresh session/seed

---

## File Summary

### New Files
| File | Description |
|------|-------------|
| `src/api-client.ts` | HTTP client for backend API |
| `src/nickname-store.ts` | localStorage wrapper for nickname |
| `src/highscore-ui.ts` | Highscore UI component (upload prompt + board) |

### Modified Files
| File | Changes |
|------|---------|
| `index.html` | Add trophy button, highscore overlay HTML |
| `src/main.css` | Add highscore styles (overlay, panel, tabs, table, form) |
| `src/main.ts` | Session management, game-over integration, trophy button, remove old HighScore |
| `src/config.ts` | Remove highscoreEnabled |

### Removed Files
| File | Reason |
|------|--------|
| `src/highscore.ts` | Replaced by server-based highscore system |
