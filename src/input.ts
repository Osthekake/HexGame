export interface Controllable {
  moveLeft(): void;
  moveUp(): void;
  moveRight(): void;
  moveDown(): void;
  rotateCounterClockwise(): void;
  rotateClockwise(): void;
}

export interface InputHandler {
  attach(target: Controllable): void;
  detach(): void;
}

export class KeyboardInput implements InputHandler {
  private target: Controllable | null = null;
  private handler: ((event: KeyboardEvent) => void) | null = null;

  attach(target: Controllable): void {
    this.target = target;
    this.handler = (event: KeyboardEvent) => {
      if (!this.target) return;

      switch (event.keyCode) {
        case 37: // Left
          this.target.moveLeft();
          break;
        case 38: // Up
          this.target.moveUp();
          break;
        case 39: // Right
          this.target.moveRight();
          break;
        case 40: // Down
          this.target.moveDown();
          break;
        case 65: // a
          this.target.rotateCounterClockwise();
          break;
        case 68: // d
          this.target.rotateClockwise();
          break;
      }
    };

    window.addEventListener('keydown', this.handler, false);
  }

  detach(): void {
    if (this.handler) {
      window.removeEventListener('keydown', this.handler, false);
      this.handler = null;
    }
    this.target = null;
  }
}

export class TouchInput implements InputHandler {
  private target: Controllable | null = null;

  attach(target: Controllable): void {
    this.target = target;
    // TODO: Implement touch/swipe controls
    console.log('Touch input not yet implemented');
  }

  detach(): void {
    this.target = null;
  }
}

export class GamepadInput implements InputHandler {
  private target: Controllable | null = null;

  attach(target: Controllable): void {
    this.target = target;
    // TODO: Implement gamepad controls
    console.log('Gamepad input not yet implemented');
  }

  detach(): void {
    this.target = null;
  }
}
