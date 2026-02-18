import type { GameTimer } from './timer';
import type { HexRenderer } from './renderer';
import type { Controllable } from './input';
import { GameConfig } from './config';
import { GameEngine } from '@hexgame/shared';
import type { Coordinate, Hex, GameAction, EngineConfig } from '@hexgame/shared';

export type { Coordinate, Hex } from '@hexgame/shared';

export class Grid implements Controllable {
  shouldDraw: boolean[][] = [];
  locks: number = 0;
  pointsHTML: HTMLElement;

  private engine: GameEngine;
  private timer: GameTimer;
  private renderer: HexRenderer;
  private actions: GameAction[] = [];
  private gameStartTime: number = 0;
  private seed: number;

  // Callbacks for game state changes
  onGameStart?: () => void;
  onGameOver?: () => void;

  constructor(
    renderer: HexRenderer,
    pointsHTML: HTMLElement,
    timer: GameTimer,
    config: GameConfig,
    seed?: number
  ) {
    this.renderer = renderer;
    this.pointsHTML = pointsHTML;
    this.timer = timer;
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);

    const engineConfig: EngineConfig = {
      gridWidth: config.grid.width,
      gridHeight: config.grid.height,
      numberOfColors: config.colors.length,
      timerMax: config.timer.maxTime,
      animationTimes: {
        rotate: config.animation.rotateAnimationTime,
        vanish: config.animation.vanishAnimationTime,
        shift: config.animation.shiftAnimationTime,
        text: config.animation.textAnimationTime,
      },
    };

    this.engine = new GameEngine(engineConfig, this.seed);
  }

  // Delegate state access to engine
  get hexes(): (Hex | undefined)[][] {
    return this.engine.hexes;
  }

  get cursor(): Coordinate {
    return this.engine.cursor;
  }

  set cursor(value: Coordinate) {
    this.engine.cursor = value;
  }

  get points(): number {
    return this.engine.points;
  }

  get hexes_wide(): number {
    return this.engine.config.gridWidth;
  }

  get hexes_high(): number {
    return this.engine.config.gridHeight;
  }

  private gameOver(): void {
    this.locks += 1;
    if (this.onGameOver) {
      this.onGameOver();
    }
  }

  lock(): boolean {
    return this.locks > 0;
  }

  hexAt(x: number, y: number): Hex | undefined {
    return this.engine.hexAt(x, y);
  }

  init(): void {
    this.renderer.reset();
    this.engine.init();
    this.actions = [];
    this.gameStartTime = 0;

    this.shouldDraw = [];
    for (let y = 0; y < this.hexes_high; y++) {
      this.shouldDraw.push([]);
      for (let x = this.hexes_wide - 1; x >= 0; x--) {
        this.shouldDraw[y].push(true);
      }
    }

    this.pointsHTML.innerHTML = "0";
    this.update();
    this.locks = 0;
  }

  update(): void {
    for (let y = this.hexes_high - 1; y >= 0; y--) {
      for (let x = this.hexes_wide - 1; x >= 0; x--) {
        if (!this.shouldDraw[y][x])
          continue;
        const hex = this.hexAt(x, y);
        if (hex === undefined)
          continue;
        this.renderer.setHexPosition(x, y, hex);
      }
    }

    if (!this.lock()) {
      this.renderer.setCursorPosition(this.cursor.x, this.cursor.y);
    }
    this.renderer.render();
  }

  private recordAction(type: GameAction['type']): void {
    const timestamp = this.gameStartTime > 0
      ? Date.now() - this.gameStartTime
      : 0;
    this.actions.push({ type, timestamp });
  }

  moveLeft(): void {
    if (this.lock()) return;
    this.recordAction('moveLeft');
    this.engine.moveLeft();
    this.update();
  }

  moveUp(): void {
    if (this.lock()) return;
    this.recordAction('moveUp');
    this.engine.moveUp();
    this.update();
  }

  moveRight(): void {
    if (this.lock()) return;
    this.recordAction('moveRight');
    this.engine.moveRight();
    this.update();
  }

  moveDown(): void {
    if (this.lock()) return;
    this.recordAction('moveDown');
    this.engine.moveDown();
    this.update();
  }

  async rotateClockwise(): Promise<void> {
    if (this.lock()) return;
    this.locks += 1;

    const wasNotRunning = !this.timer.isRunning();
    this.timer.startIfNotRunning(() => this.gameOver());
    if (wasNotRunning && this.timer.isRunning()) {
      this.gameStartTime = Date.now();
      if (this.onGameStart) {
        this.onGameStart();
      }
    }

    this.recordAction('rotateClockwise');

    // Get neighbor refs for animation (before rotation)
    const cx = this.cursor.x;
    const cy = this.cursor.y;
    const topleft = this.hexAt(cx - cy % 2, cy - 1);
    const topright = this.hexAt(cx - cy % 2 + 1, cy - 1);
    const right = this.hexAt(cx + 1, cy);
    const bottomright = this.hexAt(cx - cy % 2 + 1, cy + 1);
    const bottomleft = this.hexAt(cx - cy % 2, cy + 1);
    const left = this.hexAt(cx - 1, cy);

    await this.renderer.animateRotate(true, this.cursor, [topleft, topright, right, bottomright, bottomleft, left]);

    // Perform the hex swap on engine
    this.engine.swapClockwise();
    this.update();

    // Run cascade with animations
    await this.runCascade();

    this.locks -= 1;
  }

  async rotateCounterClockwise(): Promise<void> {
    if (this.lock()) return;
    this.locks += 1;

    const wasNotRunning = !this.timer.isRunning();
    this.timer.startIfNotRunning(() => this.gameOver());
    if (wasNotRunning && this.timer.isRunning()) {
      this.gameStartTime = Date.now();
      if (this.onGameStart) {
        this.onGameStart();
      }
    }

    this.recordAction('rotateCounterClockwise');

    // Get neighbor refs for animation (before rotation)
    const cx = this.cursor.x;
    const cy = this.cursor.y;
    const topleft = this.hexAt(cx - cy % 2, cy - 1);
    const topright = this.hexAt(cx - cy % 2 + 1, cy - 1);
    const right = this.hexAt(cx + 1, cy);
    const bottomright = this.hexAt(cx - cy % 2 + 1, cy + 1);
    const bottomleft = this.hexAt(cx - cy % 2, cy + 1);
    const left = this.hexAt(cx - 1, cy);

    await this.renderer.animateRotate(false, this.cursor, [topleft, topright, right, bottomright, bottomleft, left]);

    // Perform the hex swap on engine
    this.engine.swapCounterClockwise();
    this.update();

    // Run cascade with animations
    await this.runCascade();

    this.locks -= 1;
  }

  private async runCascade(): Promise<void> {
    this.locks += 1;

    while (true) {
      const matches = this.engine.findMatches();

      if (matches.matched.length === 0) {
        break;
      }

      // Get hex objects before removal for vanish animation
      const hexesToVanish = matches.matched.map(({ x, y }) => this.engine.hexAt(x, y));
      await this.renderer.animateVanish(hexesToVanish);

      // Remove matched hexes and generate replacements
      const newHexes = this.engine.performRemoval(matches.matched);

      // Register new tiles with renderer before shift
      for (const { hex, coord } of newHexes) {
        this.renderer.setHexPosition(coord.x, coord.y, hex);
      }

      // Perform shift (gravity)
      const shift = this.engine.performShift();
      if (shift.shifted.length > 0) {
        await this.renderer.animateShiftLeft(shift.shifted);
      }

      // Update renderer with new positions after shift
      for (let y = 0; y < this.hexes_high; y++) {
        for (let x = 0; x < this.hexes_wide; x++) {
          const hex = this.engine.hexAt(x, y);
          if (hex) {
            this.renderer.setHexPosition(x, y, hex);
          }
        }
      }
    }

    // Calculate and apply score
    const { points: calculatedPoints, timerAdded } = this.engine.calculateChainScore();
    if (timerAdded > 0) {
      this.update();
      await this.renderer.animateShowText(calculatedPoints, "chain");
      this.timer.addTime(timerAdded);
    }
    this.pointsHTML.innerHTML = String(this.points);

    this.locks -= 1;
    this.update();
  }

  getActions(): GameAction[] {
    return [...this.actions];
  }

  getScore(): number {
    return this.points;
  }

  getSeed(): number {
    return this.seed;
  }
}
