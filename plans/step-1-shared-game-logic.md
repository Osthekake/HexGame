# Step 1: Shared Game Logic, Seeded RNG, and Action Recording/Replay

**Execute this step FIRST** (before Step 2 and Step 3).

## Context

HexGame is a hex-matching puzzle game built with vanilla TypeScript + Vite. All game logic currently lives in `src/grid.ts`, tightly coupled to the renderer (animations, DOM). We need to extract the pure game logic into a shared module (`src/shared/`) that runs identically in the browser and in Node.js, so the backend (Step 1) can replay games to validate scores.

This step also introduces a seeded pseudo-random number generator (replacing `Math.random()`) so that given a seed and a sequence of player actions, the game state (and score) is fully deterministic and reproducible.

## What This Step Produces (for other steps)

- **`src/shared/game-engine.ts`**: Pure synchronous game engine used by both the frontend `Grid` wrapper and the backend replay validator
- **`src/shared/replay.ts`**: `replayGame()` function that the backend (Step 1) calls to validate submitted scores
- **`src/shared/types.ts`**: Shared types (`GameAction`, `ActionType`, `CascadeResult`, etc.) used by all three steps
- **`src/shared/rng.ts`**: `SeededRNG` class used by `GameEngine`
- **Modified `src/grid.ts`**: Now accepts a `seed` parameter, records player actions, and exposes `getActions()` / `getScore()` for Step 3 to use when uploading scores

## What This Step Depends On

Nothing - this is the foundation step.

---

## Current Architecture (what exists now)

### `src/grid.ts` (360 lines) - THE critical file

The `Grid` class mixes pure game logic with rendering/UI/timer concerns:

**Pure game state** (to extract):
- `hexes: (Hex | undefined)[][]` - 2D grid array (7x7)
- `points: number`, `chain: number[]`, `combo: number`
- `cursor: Coordinate` (default `{ x: 3, y: 3 }`)
- `hexes_wide`, `hexes_high` (from config, both 7)
- `numberOfColors` (10, from `config.colors.length`)

**Pure game logic** (to extract):
- `randomColorIndex()` - currently `Math.floor(Math.random() * this.numberOfColors)` (line 68-70)
- `generateHex()` - creates `{ id: nextId(), colorIndex: this.randomColorIndex() }` (line 72-77)
- `hexAt(x, y)` - bounds-checked grid access (line 101-107)
- `setHex(x, y, what)` - grid mutation (line 109-111)
- `moveLeft/Right/Up/Down()` - cursor movement with bounds clamping (lines 132-166)
- `rotateClockwise()` / `rotateCounterClockwise()` - hex rotation around cursor (lines 168-228)
- `checkForThreeInARow()` - match detection + cascade (lines 230-289)
- `removeAll(dead)` - remove matched hexes, generate replacements (lines 292-309)
- `shiftAll()` - gravity (slide hexes left to fill gaps) (lines 311-358)
- `init()` - populate grid with random hexes (lines 83-99)

**Rendering/UI integration** (stays in Grid wrapper):
- `this.renderer.animateVanish(...)`, `animateRotate(...)`, `animateShiftLeft(...)`, `animateShowText(...)`
- `this.renderer.setHexPosition(...)`, `setCursorPosition(...)`, `render()`
- `this.pointsHTML.innerHTML = ...`
- `this.timer.startIfNotRunning(...)`, `this.timer.addTime(5000)`
- `this.highScore.enter(...)`
- `this.locks` system (prevents input during async animations)
- `onGameStart`, `onGameOver` callbacks
- `shouldDraw[][]` optimization
- `update()` method

### Key Algorithms to Preserve Exactly

#### 1. Grid Initialization (`init()`, lines 83-99)
```typescript
for (let y = 0; y < this.hexes_high; y++) {
  this.hexes.push([]);
  for (let x = this.hexes_wide - 1; x >= 0; x--) {  // NOTE: reverse x order
    this.hexes[y].push(this.generateHex());
  }
}
```
The reverse x order is critical - it determines the initial random sequence mapping to grid positions.

#### 2. Hex Neighbor Offsets (odd-r hex coordinates)
Used in rotation and match detection:
```
right:       (x + 1, y)
left:        (x - 1, y)
topleft:     (x - y % 2, y - 1)
topright:    (x - y % 2 + 1, y - 1)
bottomleft:  (x - y % 2, y + 1)
bottomright: (x - y % 2 + 1, y + 1)
```

#### 3. Clockwise Rotation (lines 219-224)
After getting the 6 neighbors:
```typescript
this.setHex(cx + 1, cy, topright!);           // right = topright
this.setHex(cx - 1, cy, bottomleft!);         // left = bottomleft
this.setHex(cx - cy % 2, cy - 1, left!);      // topleft = left
this.setHex(cx - cy % 2 + 1, cy - 1, topleft!); // topright = topleft
this.setHex(cx - cy % 2, cy + 1, bottomright!);  // bottomleft = bottomright
this.setHex(cx - cy % 2 + 1, cy + 1, right!);    // bottomright = right
```

#### 4. Counter-Clockwise Rotation (lines 188-193)
```typescript
this.setHex(cx + 1, cy, bottomright!);
this.setHex(cx - 1, cy, topleft!);
this.setHex(cx - cy % 2, cy - 1, topright!);
this.setHex(cx - cy % 2 + 1, cy - 1, right!);
this.setHex(cx - cy % 2, cy + 1, left!);
this.setHex(cx - cy % 2 + 1, cy + 1, bottomleft!);
```

#### 5. Match Detection (`checkForThreeInARow`, lines 230-289)
Scans entire grid for 3-in-a-row in 3 directions:
```typescript
for (let y = this.hexes.length - 1; y >= 0; y--) {      // high to low
  for (let x = this.hexes_wide - 1; x >= 0; x--) {      // high to low
    // Check horizontal: current == left && current == right
    // Check diagonal1:  current == topleft && current == bottomright
    // Check diagonal2:  current == topright && current == bottomleft
    // Each match: combo += 1, push 3 coordinates to toBeRemoved
  }
}
// After scan:
if (this.combo > 0) this.chain.push(this.combo * this.combo);
this.combo = 0;
```

#### 6. Scoring Formula (lines 275-288)
When cascade ends (no more matches):
```typescript
let calculatedPoints = 0;
for (let i = this.chain.length - 1; i >= 0; i--) {
  calculatedPoints += this.chain[i] + 1;
}
calculatedPoints *= this.chain.length * this.chain.length;
if (calculatedPoints >= 6) {
  this.timer.addTime(5000);  // +5 seconds
}
this.points += calculatedPoints;
this.chain = [];
```

#### 7. Removal (`removeAll`, lines 292-309)
```typescript
for (let i = dead.length - 1; i >= 0; i--) {   // reverse order
  this.setHex(coords.x, coords.y, undefined);
  const newhex = this.generateHex();
  const newX = this.hexes[coords.y].length;     // append to end of row
  this.hexes[coords.y].push(newhex);
}
```

#### 8. Shift/Gravity (`shiftAll`, lines 311-358)
Tracks empties per row, shifts hexes left, splices undefineds:
```typescript
for (let y = 0; y < this.hexes_high; y++) {
  const row = this.hexes[y];
  let foundEmpty = false, empties = 0;
  for (let x = 0; x < row.length; x++) {
    if (row[x] === undefined) { foundEmpty = true; empties += 1; }
    else if (foundEmpty) { shifted.push({ x, y, distance: empties }); }
  }
}
// Then splice out undefineds
```

#### 9. Cascade Flow
The cascade is recursive in the original:
```
rotateClockwise() → checkForThreeInARow() → if matches: removeAll() → shiftAll() → checkForThreeInARow() → ...
                                            → if no matches: calculate score from chain
```

In the new `GameEngine`, this becomes a synchronous while loop in `processCascade()`.

### `src/utils.ts` - Just has `unique()` function
```typescript
export function unique<T>(arr: T[]): T[] {
  // Deduplicates using JSON.stringify comparison
}
```
Used in match detection (deduplicate coordinates) and shift (deduplicate shift operations).

### `src/timer.ts` - Timer Mechanics
- `hold(howlong)`: sets `helduntil = now + howlong` and calls `addTime(howlong)` (line 31-38)
- `tick()`: always subtracts delta from time (line 44), bar only renders when not held (line 51-54)
- `addTime(howmuch)`: simply `this.time += howmuch` (line 87-89)
- Effect: during animations, timer "pauses" visually but keeps ticking; `hold()` compensates by adding time

For server validation: the timer effectively doesn't lose time during animations. The server must account for this by computing total hold time from animation durations.

### `src/config.ts` - Animation Durations
```typescript
readonly animation: {
  shiftAnimationTime: number;   // 400ms
  rotateAnimationTime: number;  // 400ms
  vanishAnimationTime: number;  // 400ms
  textAnimationTime: number;    // 600ms
};
```

### Other Relevant Files
- `src/renderer.ts`: `HexRenderer` interface with `animateVanish()`, `animateRotate()`, `animateShiftLeft()`, `animateShowText()`, `setHexPosition()`, `setCursorPosition()`, `render()`, `reset()`
- `src/input.ts`: `Controllable` interface with `moveLeft/Right/Up/Down()`, `rotateClockwise/CounterClockwise()`
- `src/highscore.ts`: Current localStorage-only highscore (will be removed in Step 3)

---

## Implementation Plan

### 1. Create `src/shared/types.ts`

All shared type definitions:

```typescript
export interface Hex {
  id: number;
  colorIndex: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export type ActionType =
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'rotateClockwise'
  | 'rotateCounterClockwise';

export interface GameAction {
  type: ActionType;
  timestamp: number;  // milliseconds since game start (first rotation)
}

export interface EngineConfig {
  gridWidth: number;       // 7
  gridHeight: number;      // 7
  numberOfColors: number;  // 10
  timerMax: number;        // 30000
  animationTimes: {
    rotate: number;   // 400
    vanish: number;   // 400
    shift: number;    // 400
    text: number;     // 600
  };
}

export interface MatchResult {
  matched: Coordinate[];
  comboCount: number;
}

export interface ShiftResult {
  shifted: (Coordinate & { distance: number })[];
}

export interface CascadeStep {
  matches: MatchResult;
  removedHexIds: number[];
  newHexes: Array<{ hex: Hex; coord: Coordinate }>;
  shift: ShiftResult;
}

export interface CascadeResult {
  steps: CascadeStep[];
  totalPointsAwarded: number;
  chainLength: number;
  timerAdded: number;          // ms added (5000 if chain >= 6, else 0)
  holdTime: number;            // total animation hold time for this cascade
  rotatedHexes?: {
    before: (Hex | undefined)[];
    cursor: Coordinate;
    clockwise: boolean;
  };
}

export interface ReplayResult {
  valid: boolean;
  calculatedScore: number;
  reason?: string;
}
```

### 2. Create `src/shared/rng.ts`

Mulberry32 seeded PRNG:

```typescript
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
```

### 3. Create `src/shared/unique.ts`

Move the `unique()` function from `src/utils.ts`:

```typescript
export function unique<T>(arr: T[]): T[] {
  const result: T[] = [];
  outer: for (let i = 0; i < arr.length; i++) {
    for (let x = 0; x < result.length; x++) {
      if (JSON.stringify(result[x]) === JSON.stringify(arr[i])) {
        continue outer;
      }
    }
    result.push(arr[i]);
  }
  return result;
}
```

### 4. Create `src/shared/game-engine.ts`

The pure, synchronous game engine. This is the largest and most critical file.

Key design:
- Constructor takes `EngineConfig` and `seed`
- All state is public for inspection
- All methods are synchronous (no async, no animations)
- `processCascade()` runs the full match→remove→shift→repeat loop, returns `CascadeResult` with all steps
- Uses `SeededRNG` for all random color generation
- Tracks `timerRemaining` and `totalHoldTime` for validation

The `processCascade()` method flattens the recursive cascade into a while loop:
```
while (true):
  findMatches() → if combo > 0: chain.push(combo²), reset combo
  if no matches: break
  performRemoval(matched) → generates new hexes
  performShift() → gravity
  // collect step data for animation playback
calculateScore from chain
```

The `performRotation()` method:
1. Gets 6 neighbor hexes
2. Swaps them according to clockwise/counter-clockwise pattern
3. Calls `processCascade()` and returns result with rotation info attached

ID counter should be instance-scoped (not global) so replays are deterministic.

### 5. Create `src/shared/replay.ts`

The server-side replay validator:

```typescript
export function replayGame(
  config: EngineConfig,
  seed: number,
  actions: GameAction[],
  claimedScore: number
): ReplayResult
```

Algorithm:
1. Create `GameEngine(config, seed)`, call `init()`
2. Track `gameStarted = false`, `timerRemaining = config.timerMax`, `totalHoldTime = 0`
3. For each action:
   a. Validate timestamp >= previous timestamp (monotonically increasing)
   b. If game has started: compute elapsed time = `action.timestamp - prevTimestamp`
   c. `timerRemaining -= elapsed` (real time passes)
   d. `timerRemaining += holdTimeSinceLastAction` (compensate for animation holds from previous cascade)
   e. If `timerRemaining <= 0`: game should have ended, reject further actions
   f. Execute the action on the engine
   g. If rotation: track the `holdTime` from `CascadeResult` for next iteration
   h. If this is the first rotation: set `gameStarted = true`
4. After all actions: verify `engine.points === claimedScore`

The hold time per cascade = `rotateAnimationTime + (numSteps * (vanishAnimationTime + shiftAnimationTime)) + (textAnimationTime if points >= 6)`

### 6. Create `src/shared/index.ts`

Barrel export for all shared modules.

### 7. Modify `src/utils.ts`

Change to re-export from shared:
```typescript
export { unique } from './shared/unique';
```

### 8. Rewrite `src/grid.ts`

The `Grid` class becomes a thin async wrapper around `GameEngine`:

**Constructor changes:**
- Add `seed: number` parameter
- Create `this.engine = new GameEngine(engineConfig, seed)`
- Add `private actions: GameAction[] = []`
- Add `private gameStartTime: number = 0`

**Delegation pattern:**
- `init()`: calls `this.engine.init()`, sets up renderer positions, resets actions
- `moveLeft/Right/Up/Down()`: calls engine method, records action, calls `this.update()`
- `rotateClockwise/CounterClockwise()`:
  1. Gets neighbor hex refs (for animation)
  2. Starts timer if needed (sets `gameStartTime = Date.now()`)
  3. Records action
  4. Calls `this.engine.rotateClockwise/CounterClockwise()` (synchronous, returns `CascadeResult`)
  5. Plays rotation animation: `await this.renderer.animateRotate(...)`
  6. Syncs renderer positions
  7. Plays cascade step animations from `CascadeResult.steps`
  8. Updates points display and timer

**New methods:**
- `getActions(): GameAction[]` - returns copy of recorded actions
- `getScore(): number` - returns `this.engine.points`

**Action recording:**
- Movement actions: recorded with timestamp relative to gameStartTime
- Rotation actions: recorded with timestamp relative to gameStartTime
- Before game starts (first rotation): actions recorded with timestamp 0

**Important**: The `Grid.hexes`, `Grid.cursor`, `Grid.points` properties should delegate to `this.engine` so external code that reads them still works. Consider using getters or keeping `this.points` in sync.

**Re-export types:**
```typescript
export type { Coordinate, Hex } from './shared/types';
```

### 9. Add Tests

Install `vitest` as devDependency. Create test files:

**`src/shared/__tests__/rng.test.ts`**:
- Same seed produces same sequence
- Different seeds produce different sequences
- `nextInt(10)` always returns 0-9

**`src/shared/__tests__/game-engine.test.ts`**:
- `init()` with known seed produces expected grid
- Movement clamps correctly
- Rotation swaps hexes correctly
- `findMatches()` detects horizontal, diagonal1, diagonal2
- `processCascade()` produces correct score for known scenarios
- Score formula matches: `sum(combo² + 1) * chainLength²`

**`src/shared/__tests__/replay.test.ts`**:
- Valid game: replay matches claimed score
- Tampered score: replay rejects
- Out-of-order timestamps: replay rejects
- Action after timer expiry: replay rejects

---

## Verification

After completing this step:

1. **Unit tests pass**: `npx vitest run`
2. **Browser still works**: `npm run dev`, play the game, verify it behaves identically:
   - Tiles appear and match correctly
   - Scoring is unchanged
   - Animations play correctly
   - Timer works correctly
3. **Build succeeds**: `npm run build` produces no errors
4. **Replay roundtrip**: Create a simple test script that:
   - Creates a `GameEngine` with seed 12345
   - Calls `init()`
   - Performs a few rotations
   - Gets the score
   - Calls `replayGame()` with the same seed and actions
   - Verifies the replay score matches

---

## File Summary

### New Files
| File | Description |
|------|-------------|
| `src/shared/types.ts` | Shared type definitions |
| `src/shared/rng.ts` | Seeded PRNG (mulberry32) |
| `src/shared/unique.ts` | `unique()` utility (moved from utils.ts) |
| `src/shared/game-engine.ts` | Pure synchronous game engine |
| `src/shared/replay.ts` | Game replay validator |
| `src/shared/index.ts` | Barrel export |
| `src/shared/__tests__/rng.test.ts` | RNG tests |
| `src/shared/__tests__/game-engine.test.ts` | Engine tests |
| `src/shared/__tests__/replay.test.ts` | Replay tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/grid.ts` | Rewrite as wrapper around GameEngine; add seed param, action recording, getActions(), getScore() |
| `src/utils.ts` | Re-export unique from shared |
| `package.json` | Add vitest devDependency |
