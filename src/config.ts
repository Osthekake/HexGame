import type { HexRenderer } from './renderer';
import type { InputHandler } from './input';
import { KeyboardInput, TouchInput, GamepadInput } from './input';
import './colors.css';
import { Canvas2DRenderer } from './canvas/canvas-2d-renderer';
import { ThreeJsRenderer } from './threejs/threejs-renderer';
import { GameTimer } from './timer';

export type RendererType = 'canvas2d' | 'threejs';
export type InputType = 'keyboard' | 'touch' | 'gamepad';

// Load colors dynamically from CSS custom properties
const style = getComputedStyle(document.documentElement);
const loadColors = (count: number = 10): string[] => {
  return new Array(count).fill(0).map((_, i) => {
    const propertyName = `--tile-color-${i}`;
    return style.getPropertyValue(propertyName);
  });
};

export interface GameConfig {
  readonly renderer: RendererType;
  readonly input: InputType;
  readonly grid: {
    readonly width: number;
    readonly height: number;
  };
  readonly canvas: {
    readonly width: number;
    readonly height: number;
  }
  readonly timer: {
    readonly maxTime: number;
    readonly increment: number;
  };
  readonly animation: {
    shiftAnimationTime: number,
    rotateAnimationTime: number,
    vanishAnimationTime: number,
    textAnimationTime: number
  }
  readonly highscoreEnabled: boolean;
  readonly cursorColor: string;
  readonly backgroundColor: string;
  readonly colors: string[];
}

export const config: GameConfig = {
  renderer: 'canvas2d',
  input: 'keyboard',
  grid: {
    width: 7,
    height: 7
  },
  canvas: {
    width: 500,
    height: 500
  },
  timer: {
    maxTime: 30000,
    increment: 1000
  },
  animation: {
    shiftAnimationTime: 400,
    rotateAnimationTime: 400,
    vanishAnimationTime: 400,
    textAnimationTime: 600
  },
  colors: loadColors(10),
  cursorColor: style.getPropertyValue('--cursor-color'),
  backgroundColor: style.getPropertyValue('--content-background-color'),
  highscoreEnabled: false
};

export function createRenderer(
  type: RendererType,
  canvas: HTMLCanvasElement,
  config: GameConfig,
  timer: GameTimer
): HexRenderer {
  switch (type) {
    case 'canvas2d':
      return new Canvas2DRenderer(canvas, config, timer);
    case 'threejs':
      return new ThreeJsRenderer(canvas, config)
    default:
      throw new Error(`Unknown renderer type: ${type}`);
  }
}

export function createInputHandler(type: InputType): InputHandler {
  switch (type) {
    case 'keyboard':
      return new KeyboardInput();
    case 'touch':
      return new TouchInput();
    case 'gamepad':
      return new GamepadInput();
    default:
      throw new Error(`Unknown input type: ${type}`);
  }
}

