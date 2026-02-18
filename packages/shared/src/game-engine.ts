import { SeededRNG } from './rng';
import { unique } from './unique';
import type {
  Hex,
  Coordinate,
  EngineConfig,
  MatchResult,
  ShiftResult,
  CascadeStep,
  CascadeResult,
} from './types';

export class GameEngine {
  hexes: (Hex | undefined)[][] = [];
  points: number = 0;
  chain: number[] = [];
  combo: number = 0;
  cursor: Coordinate = { x: 3, y: 3 };

  readonly config: EngineConfig;
  private rng: SeededRNG;
  private nextIdCounter: number = 0;

  constructor(config: EngineConfig, seed: number) {
    this.config = config;
    this.rng = new SeededRNG(seed);
  }

  private nextId(): number {
    return ++this.nextIdCounter;
  }

  private randomColorIndex(): number {
    return this.rng.nextInt(this.config.numberOfColors);
  }

  private generateHex(): Hex {
    return {
      id: this.nextId(),
      colorIndex: this.randomColorIndex(),
    };
  }

  init(): void {
    this.hexes = [];
    for (let y = 0; y < this.config.gridHeight; y++) {
      this.hexes.push([]);
      for (let x = this.config.gridWidth - 1; x >= 0; x--) {
        this.hexes[y].push(this.generateHex());
      }
    }
    this.points = 0;
    this.chain = [];
    this.combo = 0;
    this.cursor = { x: 3, y: 3 };
  }

  hexAt(x: number, y: number): Hex | undefined {
    if (x < 0 || x > this.config.gridWidth - 1 || y < 0 || y > this.config.gridHeight - 1)
      return undefined;
    return this.hexes[y][x];
  }

  setHex(x: number, y: number, what: Hex | undefined): void {
    this.hexes[y][x] = what;
  }

  moveLeft(): void {
    this.cursor.x -= 1;
    if (this.cursor.x < 1)
      this.cursor.x = 1;
  }

  moveUp(): void {
    this.cursor.y -= 1;
    if (this.cursor.y < 1)
      this.cursor.y = 1;
  }

  moveRight(): void {
    this.cursor.x += 1;
    if (this.cursor.x > this.config.gridWidth - 2)
      this.cursor.x = this.config.gridWidth - 2;
  }

  moveDown(): void {
    this.cursor.y += 1;
    if (this.cursor.y > this.config.gridHeight - 2)
      this.cursor.y = this.config.gridHeight - 2;
  }

  moveCursor(x: number, y: number): void {
    this.cursor.x = Math.max(1, Math.min(x, this.config.gridWidth - 2));
    this.cursor.y = Math.max(1, Math.min(y, this.config.gridHeight - 2));
  }

  /**
   * Find all 3-in-a-row matches and update the chain.
   * Returns matched coordinates and combo count.
   */
  findMatches(): MatchResult {
    const toBeRemoved: Coordinate[] = [];
    let comboCount = 0;

    for (let y = this.hexes.length - 1; y >= 0; y--) {
      for (let x = this.config.gridWidth - 1; x >= 0; x--) {
        const current = this.hexAt(x, y)?.colorIndex;
        const right = this.hexAt(x + 1, y)?.colorIndex;
        const left = this.hexAt(x - 1, y)?.colorIndex;
        const topleft = this.hexAt(x - y % 2, y - 1)?.colorIndex;
        const topright = this.hexAt(x - y % 2 + 1, y - 1)?.colorIndex;
        const bottomleft = this.hexAt(x - y % 2, y + 1)?.colorIndex;
        const bottomright = this.hexAt(x - y % 2 + 1, y + 1)?.colorIndex;

        if (current === left && current === right) {
          comboCount += 1;
          toBeRemoved.push({ x, y });
          toBeRemoved.push({ x: x + 1, y });
          toBeRemoved.push({ x: x - 1, y });
        }
        if (current === topleft && current === bottomright) {
          comboCount += 1;
          toBeRemoved.push({ x, y });
          toBeRemoved.push({ x: x - y % 2, y: y - 1 });
          toBeRemoved.push({ x: x - y % 2 + 1, y: y + 1 });
        }
        if (current === topright && current === bottomleft) {
          comboCount += 1;
          toBeRemoved.push({ x, y });
          toBeRemoved.push({ x: x - y % 2 + 1, y: y - 1 });
          toBeRemoved.push({ x: x - y % 2, y: y + 1 });
        }
      }
    }

    if (comboCount > 0) {
      this.chain.push(comboCount * comboCount);
    }

    return {
      matched: unique(toBeRemoved),
      comboCount,
    };
  }

  performRemoval(dead: Coordinate[]): Array<{ hex: Hex; coord: Coordinate }> {
    const newTiles: Array<{ hex: Hex; coord: Coordinate }> = [];
    for (let i = dead.length - 1; i >= 0; i--) {
      const coords = dead[i];
      this.setHex(coords.x, coords.y, undefined);
      const newhex = this.generateHex();
      const newX = this.hexes[coords.y].length;
      newTiles.push({ hex: newhex, coord: { x: newX, y: coords.y } });
      this.hexes[coords.y].push(newhex);
    }
    return newTiles;
  }

  performShift(): ShiftResult {
    const shifted: Array<Coordinate & { distance: number }> = [];
    for (let y = 0; y < this.config.gridHeight; y++) {
      const row = this.hexes[y];
      let foundEmpty = false;
      let empties = 0;
      for (let x = 0; x < row.length; x++) {
        if (row[x] === undefined) {
          foundEmpty = true;
          empties += 1;
          shifted.push({ x, y, distance: empties });
        } else if (foundEmpty) {
          shifted.push({ x, y, distance: empties });
        }
      }
    }

    const shiftedUniq = unique(shifted);

    // Splice out undefineds
    for (let y = 0; y < this.config.gridHeight; y++) {
      const row = this.hexes[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === undefined) {
          row.splice(x, 1);
          x -= 1;
        }
      }
    }

    return { shifted: shiftedUniq };
  }

  /**
   * Calculate score from the current chain, update points, reset chain.
   * Returns the points awarded and timer bonus.
   */
  calculateChainScore(): { points: number; timerAdded: number } {
    let calculatedPoints = 0;
    for (let i = this.chain.length - 1; i >= 0; i--) {
      calculatedPoints += this.chain[i] + 1;
    }
    calculatedPoints *= this.chain.length * this.chain.length;

    const timerAdded = calculatedPoints >= 6 ? 5000 : 0;
    this.points += calculatedPoints;
    this.chain = [];
    return { points: calculatedPoints, timerAdded };
  }

  private getNeighborRefs(cx: number, cy: number) {
    return {
      right: this.hexAt(cx + 1, cy),
      left: this.hexAt(cx - 1, cy),
      topleft: this.hexAt(cx - cy % 2, cy - 1),
      topright: this.hexAt(cx - cy % 2 + 1, cy - 1),
      bottomleft: this.hexAt(cx - cy % 2, cy + 1),
      bottomright: this.hexAt(cx - cy % 2 + 1, cy + 1),
    };
  }

  /** Just perform the hex swap (no cascade). Used by Grid wrapper. */
  swapClockwise(): void {
    const cx = this.cursor.x;
    const cy = this.cursor.y;
    const { right, left, topleft, topright, bottomleft, bottomright } = this.getNeighborRefs(cx, cy);

    this.setHex(cx + 1, cy, topright!);
    this.setHex(cx - 1, cy, bottomleft!);
    this.setHex(cx - cy % 2, cy - 1, left!);
    this.setHex(cx - cy % 2 + 1, cy - 1, topleft!);
    this.setHex(cx - cy % 2, cy + 1, bottomright!);
    this.setHex(cx - cy % 2 + 1, cy + 1, right!);
  }

  /** Just perform the hex swap (no cascade). Used by Grid wrapper. */
  swapCounterClockwise(): void {
    const cx = this.cursor.x;
    const cy = this.cursor.y;
    const { right, left, topleft, topright, bottomleft, bottomright } = this.getNeighborRefs(cx, cy);

    this.setHex(cx + 1, cy, bottomright!);
    this.setHex(cx - 1, cy, topleft!);
    this.setHex(cx - cy % 2, cy - 1, topright!);
    this.setHex(cx - cy % 2 + 1, cy - 1, right!);
    this.setHex(cx - cy % 2, cy + 1, left!);
    this.setHex(cx - cy % 2 + 1, cy + 1, bottomleft!);
  }

  /**
   * Full cascade: find matches → remove → shift → repeat, then score.
   * Used by processCascade and the rotate convenience methods.
   */
  private runCascade(): CascadeResult {
    const steps: CascadeStep[] = [];

    while (true) {
      const matches = this.findMatches();

      if (matches.matched.length === 0) {
        break;
      }

      const removedHexIds = matches.matched
        .map(c => this.hexAt(c.x, c.y)?.id)
        .filter((id): id is number => id !== undefined);

      const newHexes = this.performRemoval(matches.matched);
      const shift = this.performShift();

      steps.push({
        matches,
        removedHexIds,
        newHexes,
        shift,
      });
    }

    const { points: totalPointsAwarded, timerAdded } = this.calculateChainScore();

    // Calculate hold time for animations
    const { rotate, vanish, shift, text } = this.config.animationTimes;
    let holdTime = rotate;
    holdTime += steps.length * (vanish + shift);
    if (timerAdded > 0) {
      holdTime += text;
    }

    return {
      steps,
      totalPointsAwarded,
      chainLength: steps.length,
      timerAdded,
      holdTime,
    };
  }

  /** Swap + cascade. Used by replay validator. */
  rotateClockwise(): CascadeResult {
    this.swapClockwise();
    return this.runCascade();
  }

  /** Swap + cascade. Used by replay validator. */
  rotateCounterClockwise(): CascadeResult {
    this.swapCounterClockwise();
    return this.runCascade();
  }
}
