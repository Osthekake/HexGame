import Hammer from 'hammerjs';
import type { HexRenderer } from './renderer';
import type { Grid } from './grid';

export interface Controllable {
  moveLeft(): void;
  moveUp(): void;
  moveRight(): void;
  moveDown(): void;
  rotateCounterClockwise(): void;
  rotateClockwise(): void;
}

export interface InputHandler {
  attach(target: Controllable, renderer?: any, grid?: any): void;
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
  private renderer: HexRenderer | null = null;
  private grid: Grid | null = null;
  private hammer: HammerManager | null = null;

  attach(target: Controllable, renderer?: any, grid?: any): void {
    this.target = target;
    this.renderer = renderer;
    this.grid = grid;

    if (!renderer || !grid) {
      console.error('TouchInput requires renderer and grid references');
      return;
    }

    // Get canvas element
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas not found for touch input');
      return;
    }

    // Initialize Hammer.js
    this.hammer = new Hammer(canvas);

    // Configure swipe recognizer for horizontal swipes only
    this.hammer.get('swipe').set({
      direction: Hammer.DIRECTION_HORIZONTAL,
      threshold: 30,      // Minimum distance for swipe
      velocity: 0.3       // Minimum velocity
    });

    // Configure tap recognizer
    this.hammer.get('tap').set({
      time: 250,          // Maximum time for tap
      threshold: 10       // Maximum movement for tap
    });

    // Prevent tap from firing during swipe
    this.hammer.get('tap').requireFailure('swipe');

    // Register event handlers
    this.hammer.on('swipeleft', this.handleSwipeLeft.bind(this));
    this.hammer.on('swiperight', this.handleSwipeRight.bind(this));
    this.hammer.on('tap', this.handleTap.bind(this));
  }

  detach(): void {
    if (this.hammer) {
      this.hammer.destroy();
      this.hammer = null;
    }
    this.target = null;
    this.renderer = null;
    this.grid = null;
  }

  private handleSwipeLeft(event: HammerInput): void {
    if (!this.target || !this.grid) return;

    // Check game lock before rotating
    if (this.grid.lock()) return;

    // Left swipe = counter-clockwise (matches 'A' key)
    this.target.rotateCounterClockwise();
  }

  private handleSwipeRight(event: HammerInput): void {
    if (!this.target || !this.grid) return;

    // Check game lock before rotating
    if (this.grid.lock()) return;

    // Right swipe = clockwise (matches 'D' key)
    this.target.rotateClockwise();
  }

  private handleTap(event: HammerInput): void {
    if (!this.target || !this.renderer || !this.grid) return;

    // Check game lock before moving
    if (this.grid.lock()) return;

    // Get tap coordinates relative to canvas
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const pixelX = event.center.x - rect.left;
    const pixelY = event.center.y - rect.top;

    // Convert pixel to grid coordinates
    // Renderers now return only viable hexes [1,5], or null if impossible
    const gridCoord = this.renderer.pixelToGrid(pixelX, pixelY);

    if (!gridCoord) {
      // Renderer couldn't find a valid hex
      return;
    }

    // Move cursor to tapped position (already validated by renderer)
    this.grid.cursor.x = gridCoord.gridX;
    this.grid.cursor.y = gridCoord.gridY;
    this.grid.update();
  }
}

export class GamepadInput implements InputHandler {
  private target: Controllable | null = null;
  private animationFrameId: number | null = null;
  private buttonStates: Map<number, boolean> = new Map();
  private onRestart?: () => void;

  // Button mappings (standard gamepad layout)
  private readonly BUTTON_LEFT = 14;
  private readonly BUTTON_RIGHT = 15;
  private readonly BUTTON_UP = 12;
  private readonly BUTTON_DOWN = 13;
  private readonly BUTTON_L1 = 4;  // Left shoulder
  private readonly BUTTON_R1 = 5;  // Right shoulder
  private readonly BUTTON_START = 9; // Start button

  // D-pad threshold for analog sticks (as fallback)
  private readonly ANALOG_THRESHOLD = 0.5;

  attach(target: Controllable): void {
    this.target = target;
    this.buttonStates.clear();
    this.startPolling();
  }

  setRestartCallback(callback: () => void): void {
    this.onRestart = callback;
  }

  detach(): void {
    this.stopPolling();
    this.target = null;
    this.buttonStates.clear();
  }

  private startPolling(): void {
    const poll = () => {
      if (!this.target) return;

      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0]; // Use first connected gamepad

      if (gamepad) {
        this.handleGamepadInput(gamepad);
      }

      this.animationFrameId = requestAnimationFrame(poll);
    };

    this.animationFrameId = requestAnimationFrame(poll);
  }

  private stopPolling(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private handleGamepadInput(gamepad: Gamepad): void {
    if (!this.target) return;

    // Handle D-pad buttons
    this.handleButton(this.BUTTON_LEFT, gamepad.buttons[this.BUTTON_LEFT]?.pressed, () => {
      this.target!.moveLeft();
    });

    this.handleButton(this.BUTTON_RIGHT, gamepad.buttons[this.BUTTON_RIGHT]?.pressed, () => {
      this.target!.moveRight();
    });

    this.handleButton(this.BUTTON_UP, gamepad.buttons[this.BUTTON_UP]?.pressed, () => {
      this.target!.moveUp();
    });

    this.handleButton(this.BUTTON_DOWN, gamepad.buttons[this.BUTTON_DOWN]?.pressed, () => {
      this.target!.moveDown();
    });

    // Handle shoulder buttons for rotation
    this.handleButton(this.BUTTON_L1, gamepad.buttons[this.BUTTON_L1]?.pressed, () => {
      this.target!.rotateCounterClockwise();
    });

    this.handleButton(this.BUTTON_R1, gamepad.buttons[this.BUTTON_R1]?.pressed, () => {
      this.target!.rotateClockwise();
    });

    // Handle Start button for restart
    this.handleButton(this.BUTTON_START, gamepad.buttons[this.BUTTON_START]?.pressed, () => {
      if (this.onRestart) {
        this.onRestart();
      }
    });

    // Fallback: Handle left analog stick as D-pad
    if (gamepad.axes.length >= 2) {
      const axisX = gamepad.axes[0];
      const axisY = gamepad.axes[1];

      this.handleButton(1000, axisX < -this.ANALOG_THRESHOLD, () => {
        this.target!.moveLeft();
      });

      this.handleButton(1001, axisX > this.ANALOG_THRESHOLD, () => {
        this.target!.moveRight();
      });

      this.handleButton(1002, axisY < -this.ANALOG_THRESHOLD, () => {
        this.target!.moveUp();
      });

      this.handleButton(1003, axisY > this.ANALOG_THRESHOLD, () => {
        this.target!.moveDown();
      });
    }
  }

  private handleButton(buttonId: number, pressed: boolean | undefined, action: () => void): void {
    const wasPressed = this.buttonStates.get(buttonId) || false;
    const isPressed = pressed || false;

    // Trigger action on button press (not release)
    if (isPressed && !wasPressed) {
      action();
    }

    this.buttonStates.set(buttonId, isPressed);
  }
}
