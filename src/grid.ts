import { unique } from './utils';
import { Animation } from './canvas/canvas-animation';
import type { GameTimer } from './timer';
import type { HighScore } from './highscore';
import type { HexRenderer } from './renderer';
import type { Controllable } from './input';
import { GameConfig } from './config';

export interface Coordinate {
  x: number;
  y: number;
}

let lastId = 0
function nextId(){
  return ++lastId
}

export interface Hex {
  id: number;
  colorIndex: number;
}

export class Grid implements Controllable {
  hexes: (Hex | undefined)[][] = [];
  points: number = 0;
  chain: number[] = [];
  combo: number = 0;
  shouldDraw: boolean[][] = [];
  hexes_wide: number;
  hexes_high: number;
  cursor: Coordinate = { x: 1, y: 1 };
  locks: number = 0;
  pointsHTML: HTMLElement;

  private animation: Animation;
  private timer: GameTimer;
  private highScore: HighScore;
  private renderer: HexRenderer;
  private numberOfColors: number;

  constructor(
    renderer: HexRenderer,
    pointsHTML: HTMLElement,
    timer: GameTimer,
    highScore: HighScore,
    config: GameConfig
  ) {
    this.renderer = renderer;
    this.pointsHTML = pointsHTML;
    this.timer = timer;
    this.highScore = highScore;
    this.hexes_wide = config.grid.width;
    this.hexes_high = config.grid.height;
    this.animation = new Animation(this, timer, renderer);
    this.numberOfColors = config.colors.length
  }

  private gameOver(): void {
    this.locks += 1;
    this.highScore.enter(this.points);
  }

  private randomColorIndex(){
    return Math.floor(Math.random() * this.numberOfColors)
  }

  private generateHex() {
    return {
      id: nextId(),
      colorIndex: this.randomColorIndex()
    }
  }

  lock(): boolean {
    return this.locks > 0;
  }

  init(): void {
    this.hexes = [];
    this.shouldDraw = [];
    for (let y = 0; y < this.hexes_high; y++) {
      this.hexes.push([]);
      this.shouldDraw.push([]);
      for (let x = this.hexes_wide - 1; x >= 0; x--) {
        this.hexes[y].push(this.generateHex());
        this.shouldDraw[y].push(true);
      }
    }
    this.points = 0;
    this.pointsHTML.innerHTML = "0";
    this.update();
    this.locks = 0;
  }

  hexAt(x: number, y: number): Hex | undefined {
    if (x < 0 || x > this.hexes_wide - 1 || y < 0 || y > this.hexes_high - 1)
      return undefined;
    if (!this.hexes[y])
      console.log("hexes[" + y + "]: " + this.hexes[y]);
    return this.hexes[y][x];
  }

  setHex(x: number, y: number, what: Hex | undefined): void {
    this.hexes[y][x] = what;
  }

  update(): void {
    this.renderer.clear();

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
  }

  moveLeft(): void {
    if (this.lock())
      return;
    this.cursor.x -= 1;
    if (this.cursor.x < 1)
      this.cursor.x = 1;
    this.update();
  }

  moveUp(): void {
    if (this.lock())
      return;
    this.cursor.y -= 1;
    if (this.cursor.y < 1)
      this.cursor.y = 1;
    this.update();
  }

  moveRight(): void {
    if (this.lock())
      return;
    this.cursor.x += 1;
    if (this.cursor.x > this.hexes_wide - 2)
      this.cursor.x = this.hexes_wide - 2;
    this.update();
  }

  moveDown(): void {
    if (this.lock())
      return;
    this.cursor.y += 1;
    if (this.cursor.y > this.hexes_high - 2)
      this.cursor.y = this.hexes_high - 2;
    this.update();
  }

  async rotateCounterClockwise(): Promise<void> {
    if (this.lock())
      return;

    this.timer.startIfNotRunning(() => this.gameOver());
    await this.animation.rotate(false, this.cursor);

    const right = this.hexAt(this.cursor.x + 1, this.cursor.y);
    const left = this.hexAt(this.cursor.x - 1, this.cursor.y);
    const topleft = this.hexAt(this.cursor.x - this.cursor.y % 2, this.cursor.y - 1);
    const topright = this.hexAt(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y - 1);
    const bottomleft = this.hexAt(this.cursor.x - this.cursor.y % 2, this.cursor.y + 1);
    const bottomright = this.hexAt(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y + 1);
    this.setHex(this.cursor.x + 1, this.cursor.y, bottomright!);
    this.setHex(this.cursor.x - 1, this.cursor.y, topleft!);
    this.setHex(this.cursor.x - this.cursor.y % 2, this.cursor.y - 1, topright!);
    this.setHex(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y - 1, right!);
    this.setHex(this.cursor.x - this.cursor.y % 2, this.cursor.y + 1, left!);
    this.setHex(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y + 1, bottomleft!);
    this.update();
    await this.checkForThreeInARow();
  }

  async rotateClockwise(): Promise<void> {
    if (this.lock())
      return;

    this.timer.startIfNotRunning(() => this.gameOver());
    await this.animation.rotate(true, this.cursor);

    const right = this.hexAt(this.cursor.x + 1, this.cursor.y);
    const left = this.hexAt(this.cursor.x - 1, this.cursor.y);
    const topleft = this.hexAt(this.cursor.x - this.cursor.y % 2, this.cursor.y - 1);
    const topright = this.hexAt(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y - 1);
    const bottomleft = this.hexAt(this.cursor.x - this.cursor.y % 2, this.cursor.y + 1);
    const bottomright = this.hexAt(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y + 1);
    this.setHex(this.cursor.x + 1, this.cursor.y, topright!);
    this.setHex(this.cursor.x - 1, this.cursor.y, bottomleft!);
    this.setHex(this.cursor.x - this.cursor.y % 2, this.cursor.y - 1, left!);
    this.setHex(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y - 1, topleft!);
    this.setHex(this.cursor.x - this.cursor.y % 2, this.cursor.y + 1, bottomright!);
    this.setHex(this.cursor.x - this.cursor.y % 2 + 1, this.cursor.y + 1, right!);
    this.update();
    await this.checkForThreeInARow();
  }

  async checkForThreeInARow(): Promise<void> {
    const toBeRemoved: Coordinate[] = [];
    this.locks += 1;

    for (let y = this.hexes.length - 1; y >= 0; y--) {
      for (let x = this.hexes_wide - 1; x >= 0; x--) {
        const current = this.hexAt(x, y)?.colorIndex;
        const right = this.hexAt(x + 1, y)?.colorIndex;
        const left = this.hexAt(x - 1, y)?.colorIndex;
        const topleft = this.hexAt(x - y % 2, y - 1)?.colorIndex;
        const topright = this.hexAt(x - y % 2 + 1, y - 1)?.colorIndex;
        const bottomleft = this.hexAt(x - y % 2, y + 1)?.colorIndex;
        const bottomright = this.hexAt(x - y % 2 + 1, y + 1)?.colorIndex;

        if (current === left && current === right) {
          this.combo += 1;
          toBeRemoved.push({ x, y });
          toBeRemoved.push({ x: x + 1, y });
          toBeRemoved.push({ x: x - 1, y });
        }
        if (current === topleft && current === bottomright) {
          this.combo += 1;
          toBeRemoved.push({ x, y });
          toBeRemoved.push({ x: x - y % 2, y: y - 1 });
          toBeRemoved.push({ x: x - y % 2 + 1, y: y + 1 });
        }
        if (current === topright && current === bottomleft) {
          this.combo += 1;
          toBeRemoved.push({ x, y });
          toBeRemoved.push({ x: x - y % 2 + 1, y: y - 1 });
          toBeRemoved.push({ x: x - y % 2, y: y + 1 });
        }
      }
    }

    if (this.combo > 0)
      this.chain.push(this.combo * this.combo);
    this.combo = 0;

    const uniq = unique(toBeRemoved);
    if (uniq.length > 0) {
      await this.animation.vanish(uniq);
      this.removeAll(uniq);
      this.update();
    } else {
      let calculatedPoints = 0;
      for (let i = this.chain.length - 1; i >= 0; i--) {
        calculatedPoints += this.chain[i] + 1;
      }
      calculatedPoints *= this.chain.length * this.chain.length;
      if (calculatedPoints >= 6) {
        await this.animation.showText(calculatedPoints, "chain");
        this.timer.addTime(5000);
      }
      this.points += calculatedPoints;
      this.pointsHTML.innerHTML = String(this.points);
      this.chain = [];
    }
    this.locks -= 1;
  }

  removeAll(dead: Coordinate[]): void {
    for (let i = dead.length - 1; i >= 0; i--) {
      const coords = dead[i];
      this.setHex(coords.x, coords.y, undefined);
      const newhex = this.generateHex();
      this.hexes[coords.y].push(newhex);
    }
    this.shiftAll();
  }

  async shiftAll(): Promise<void> {
    this.locks += 1;
    const shifted: Array<Coordinate & { distance: number }> = [];
    for (let y = 0; y < this.hexes_high; y++) {
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
    if (shiftedUniq.length > 0) {
      await this.animation.shiftLeft(shiftedUniq);
      for (let y = 0; y < this.hexes_high; y++) {
        const row = this.hexes[y];
        for (let x = 0; x < row.length; x++) {
          if (row[x] === undefined) {
            row.splice(x, 1);
            x -= 1;
          }
        }
      }
      await this.checkForThreeInARow();
      this.locks -= 1;
    } else {
      await this.checkForThreeInARow();
      this.locks -= 1;
    }
    this.update();
  }
}
