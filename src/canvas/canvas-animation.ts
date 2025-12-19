import { requestAnimFrame } from '../utils';
import type { Grid } from '../grid';
import type { Coordinate } from '../grid';
import type { GameTimer } from '../timer';
import type { HexRenderer } from '../renderer';
import { AnimationSystem } from '../animation';

const Constants = {
  shiftAnimationTime: 400,
  rotateAnimationTime: 400,
  vanishAnimationTime: 400,
  textAnimationTime: 600
};

export class Animation implements AnimationSystem {
  private grid: Grid;
  private timer: GameTimer;
  private renderer: HexRenderer;
  private secondsPerFrame = 1000 / 60;

  constructor(grid: Grid, timer: GameTimer, renderer: HexRenderer) {
    this.grid = grid;
    this.timer = timer;
    this.renderer = renderer;
  }

  rotate(clockwise: boolean, center: Coordinate): Promise<void> {
    this.grid.locks += 1;
    this.timer.hold(Constants.rotateAnimationTime);
    const hexes = [
      { x: center.x - center.y % 2, y: center.y + 1 }, // bottomleft
      { x: center.x - 1, y: center.y }, // left
      { x: center.x - center.y % 2, y: center.y - 1 }, // topleft
      { x: center.x - center.y % 2 + 1, y: center.y - 1 }, // topright
      { x: center.x + 1, y: center.y }, // right
      { x: center.x - center.y % 2 + 1, y: center.y + 1 } // bottomright
    ];
    return new Promise<void>((resolve) => {
      const animator = new RotateAnimation(
        this.grid,
        this.renderer,
        clockwise,
        center,
        hexes,
        resolve
      );
      requestAnimFrame(animator.render.bind(animator));
    });
  }

  vanish(hexes: Coordinate[]): Promise<void> {
    this.grid.locks += 1;
    this.timer.hold(Constants.vanishAnimationTime);
    return new Promise<void>((resolve) => {
      const animator = new VanishAnimation(this.grid, this.renderer, hexes, resolve);
      requestAnimFrame(animator.render.bind(animator));
    });
  }

  shiftLeft(hexes: Array<Coordinate & { distance: number }>): Promise<void> {
    this.grid.locks += 1;
    this.timer.hold(Constants.shiftAnimationTime);
    return new Promise<void>((resolve) => {
      const animator = new ShiftAnimation(this.grid, this.renderer, hexes, resolve);
      requestAnimFrame(animator.render.bind(animator));
    });
  }

  showText(chain: number, kind: string): Promise<void> {
    this.grid.locks += 1;
    this.timer.hold(Constants.textAnimationTime);
    return new Promise<void>((resolve) => {
      const animator = new TextAnimation(this.grid, this.renderer, chain, kind, resolve);
      requestAnimFrame(animator.render.bind(animator));
    });
  }
}

class RotateAnimation {
  private grid: Grid;
  private renderer: HexRenderer;
  private hexes: Coordinate[];
  private center: Coordinate;
  private onComplete: () => void;
  private clockwise: boolean;
  private start: number = -1;

  constructor(
    grid: Grid,
    renderer: HexRenderer,
    clockwise: boolean,
    center: Coordinate,
    hexes: Coordinate[],
    onComplete: () => void
  ) {
    this.grid = grid;
    this.renderer = renderer;
    for (let i = 0; i < hexes.length; i++) {
      const coords = hexes[i];
      this.grid.shouldDraw[coords.y][coords.x] = false;
    }
    this.hexes = hexes;
    this.center = center;
    this.onComplete = onComplete;
    this.clockwise = clockwise;
  }

  private complete(time: number): boolean {
    return (time - this.start) > Constants.rotateAnimationTime;
  }

  render(time: number): void {
    if (this.start === -1) this.start = time;
    const progress = (time - this.start) / Constants.rotateAnimationTime;

    this.grid.update();

    for (let i = this.hexes.length - 1; i >= 0; i--) {
      const hexCoordinate = this.hexes[i];
      const hex = this.grid.hexAt(hexCoordinate.x, hexCoordinate.y);
      const rotationIndex = this.hexes.length - 1 - i;
      if(hex)
        this.renderer.setHexPosition(hexCoordinate.x, hexCoordinate.y, hex, {
          type: 'rotate',
          centerGridX: this.center.x,
          centerGridY: this.center.y,
          progress,
          clockwise: this.clockwise,
          rotationIndex
        });
    }

    if (!this.complete(time))
      requestAnimFrame(this.render.bind(this));
    else {
      for (let i = 0; i < this.hexes.length; i++) {
        const coords = this.hexes[i];
        this.grid.shouldDraw[coords.y][coords.x] = true;
      }
      this.grid.locks -= 1;
      this.onComplete();
    }
  }
}

class ShiftAnimation {
  private grid: Grid;
  private renderer: HexRenderer;
  private hexes: Array<Coordinate & { distance: number }>;
  private onComplete: () => void;
  private start: number = -1;

  constructor(grid: Grid, renderer: HexRenderer, hexes: Array<Coordinate & { distance: number }>, onComplete: () => void) {
    this.grid = grid;
    this.renderer = renderer;
    for (let i = 0; i < hexes.length; i++) {
      const coords = hexes[i];
      this.grid.shouldDraw[coords.y][coords.x] = false;
    }
    this.hexes = hexes;
    this.onComplete = onComplete;
  }

  private complete(time: number): boolean {
    return (time - this.start) > Constants.shiftAnimationTime;
  }

  render(time: number): void {
    if (this.start === -1) this.start = time;
    const progress = (time - this.start) / Constants.shiftAnimationTime;

    this.grid.update();

    for (let i = this.hexes.length - 1; i >= 0; i--) {
      const hexCoordinate = this.hexes[i];
      const hex = this.grid.hexAt(hexCoordinate.x, hexCoordinate.y);
      if(hex)
        this.renderer.setHexPosition(hexCoordinate.x, hexCoordinate.y, hex, {
          type: 'shift',
          distance: hexCoordinate.distance,
          progress
        });
    }

    if (!this.complete(time))
      requestAnimFrame(this.render.bind(this));
    else {
      for (let i = 0; i < this.hexes.length; i++) {
        const coords = this.hexes[i];
        this.grid.shouldDraw[coords.y][coords.x] = true;
      }
      this.grid.locks -= 1;
      this.onComplete();
    }
  }
}

class VanishAnimation {
  private grid: Grid;
  private renderer: HexRenderer;
  private hexes: Coordinate[];
  private onComplete: () => void;
  private start: number = -1;

  constructor(grid: Grid, renderer: HexRenderer, hexes: Coordinate[], onComplete: () => void) {
    this.grid = grid;
    this.renderer = renderer;
    for (let i = 0; i < hexes.length; i++) {
      const coords = hexes[i];
      this.grid.shouldDraw[coords.y][coords.x] = false;
    }
    this.hexes = hexes;
    this.onComplete = onComplete;
  }

  private complete(time: number): boolean {
    return (time - this.start) > Constants.vanishAnimationTime;
  }

  render(time: number): void {
    if (this.start === -1) this.start = time;
    const progress = (time - this.start) / Constants.vanishAnimationTime;

    this.grid.update();

    for (let i = this.hexes.length - 1; i >= 0; i--) {
      const hexCoordinates = this.hexes[i];
      const hex = this.grid.hexAt(hexCoordinates.x, hexCoordinates.y);
      if(hex)
        this.renderer.setHexPosition(hexCoordinates.x, hexCoordinates.y, hex, {
          type: 'vanish',
          progress
        });
    }

    if (!this.complete(time))
      requestAnimFrame(this.render.bind(this));
    else {
      for (let i = 0; i < this.hexes.length; i++) {
        const coords = this.hexes[i];
        this.grid.shouldDraw[coords.y][coords.x] = true;
      }
      this.grid.locks -= 1;
      this.onComplete();
    }
  }
}

class TextAnimation {
  private grid: Grid;
  private renderer: HexRenderer;
  private start: number = -1;
  private animationTime: number = Constants.textAnimationTime;
  private chain: number;
  private onComplete: () => void;

  constructor(grid: Grid, renderer: HexRenderer, chain: number, _info: string, onComplete: () => void) {
    this.grid = grid;
    this.renderer = renderer;
    this.chain = chain;
    this.onComplete = onComplete;
  }

  private complete(time: number): boolean {
    return (time - this.start) > this.animationTime;
  }

  render(time: number): void {
    if (this.start === -1) this.start = time;
    const progress = (time - this.start) / this.animationTime;
    this.grid.update();

    const textHeight = Math.round(5 + progress * this.chain * 5);

    const gradientFill = this.renderer.createHorizontalGradient([
      { offset: 0, color: "magenta" },
      { offset: 0.5, color: "blue" },
      { offset: 1.0, color: "red" }
    ]);

    // Center of grid is approximately 3.5, 3.5
    this.renderer.drawText(String(this.chain), 3.5, 3.5, textHeight, gradientFill);

    if (!this.complete(time))
      requestAnimFrame(this.render.bind(this));
    else {
      this.grid.locks -= 1;
      this.grid.update();
      this.onComplete();
    }
  }
}
