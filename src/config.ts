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
export const loadColors = (count: number = 10): string[] => {
  const style = getComputedStyle(document.body);
  return new Array(count).fill(0).map((_, i) => {
    const propertyName = `--tile-color-${i}`;
    return style.getPropertyValue(propertyName);
  });
};

export interface GameConfig {
  renderer: RendererType;
  input: InputType;
  readonly grid: {
    readonly width: number;
    readonly height: number;
  };
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
  cursorColor: string;
  cursorGlowColor: string;
  backgroundColor: string;
  colors: string[];
}

// Load renderer from localStorage or use default
const loadRenderer = (): RendererType => {
  const saved = localStorage.getItem('renderer');
  if (saved === 'canvas2d' || saved === 'threejs') {
    return saved;
  }
  return 'threejs';
};

// Detect if device is a mobile/touch device
const isMobileDevice = (): boolean => {
  // Check for touch capability
  const hasTouchCapability =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // Check user agent for mobile devices
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);

  // Device is mobile if it has touch AND mobile user agent
  // This avoids false positives from touch-enabled laptops
  return hasTouchCapability && isMobileUA;
};

// Load input from localStorage or use default
const loadInput = (): InputType => {
  const saved = localStorage.getItem('input');
  if (saved === 'keyboard' || saved === 'touch' || saved === 'gamepad') {
    // Always respect user's saved preference
    return saved;
  }
  // No saved preference - use default based on device type
  return isMobileDevice() ? 'touch' : 'keyboard';
};

export const config: GameConfig = {
  renderer: loadRenderer(),
  input: loadInput(),
  grid: {
    width: 7,
    height: 7
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
  colors: [], // Will be loaded after body class is set
  cursorColor: '', // Will be loaded after body class is set
  cursorGlowColor: '', // Will be loaded after body class is set
  backgroundColor: '', // Will be loaded after body class is set
  highscoreEnabled: false
};

// Update config colors and styles after body class is set
export function updateConfigStyles(): void {
  const style = getComputedStyle(document.documentElement);
  config.colors = loadColors(10);
  config.cursorColor = style.getPropertyValue('--cursor-color');
  config.cursorGlowColor = style.getPropertyValue('--cursor-glow-color');
  config.backgroundColor = style.getPropertyValue('--content-background-color');
}

// Save renderer preference to localStorage
export function saveRenderer(renderer: RendererType): void {
  localStorage.setItem('renderer', renderer);
}

// Save input preference to localStorage
export function saveInput(input: InputType): void {
  localStorage.setItem('input', input);
}

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
      return new ThreeJsRenderer(canvas, config, timer)
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

