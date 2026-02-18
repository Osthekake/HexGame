import { Grid } from './grid';
import { Timer, Bar } from './timer';
import { createSession } from './api-client';
import { HighscoreUI } from './highscore-ui';
import { config, createRenderer, createInputHandler, saveRenderer, saveInput, updateConfigStyles } from './config';
import { SettingsMenu } from './settings';
import { WakeLockManager } from './wakelock';
import { ThreeJsRenderer } from './threejs/threejs-renderer';
import { trackSettingsRenderer, trackSettingsInput, trackGameStart, trackGameOver } from './tracking';
import type { RendererType, InputType } from './config';
import type { HexRenderer } from './renderer';
import type { InputHandler } from './input';
import  './main.css'

// Get DOM elements
const canvasContainer = document.getElementById("canvas-container") as HTMLElement;
if (!canvasContainer) {
  throw new Error("Canvas container not found");
}

const pointsElement = document.getElementById("points") as HTMLElement;
if (!pointsElement) {
  throw new Error("Points element not found");
}

const timeElement = document.getElementById("time") as HTMLElement;
if (!timeElement) {
  throw new Error("Time element not found");
}

const overlayContainer = document.querySelector(".overlay-container") as HTMLElement;
if (!overlayContainer) {
  throw new Error("Overlay container not found");
}

const instructionText = document.querySelector(".instruction-text") as HTMLElement;
if (!instructionText) {
  throw new Error("Instruction text not found");
}

const restartButton = document.getElementById("restart-button") as HTMLElement;
if (!restartButton) {
  throw new Error("Restart button not found");
}

const gameOverText = document.getElementById("game-over-text") as HTMLElement;
if (!gameOverText) {
  throw new Error("Game over text not found");
}

// Game state
let renderer: HexRenderer;
let grid: Grid;
let inputHandler: InputHandler;
let resizeHandler: () => void;
let canvas: HTMLCanvasElement;
let isGameOver = false;

// Session state
let currentSessionId = '';
let currentSeed = 0;
let isOnline = false;

// Persistent instances
const bar = new Bar(timeElement);
bar.render(100);

const timer = new Timer(bar, config.timer.maxTime, config.timer.increment);
const wakeLock = new WakeLockManager();
const highscoreUI = new HighscoreUI();

async function startNewSession(): Promise<void> {
  try {
    const session = await createSession();
    currentSessionId = session.sessionId;
    currentSeed = session.seed;
    highscoreUI.setPlayerCountry(session.country);
    isOnline = true;
  } catch {
    currentSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    currentSessionId = '';
    isOnline = false;
    console.warn('Backend unavailable, playing in offline mode');
  }
}

// Overlay visibility control
function showGameOverUI(): void {
  instructionText.style.display = 'none';
  gameOverText.style.display = 'block';
  restartButton.style.display = 'block';
}

function showStartUI(): void {
  instructionText.style.display = 'block';
  gameOverText.style.display = 'none';
  restartButton.style.display = 'none';
}

function hideOverlay(): void {
  instructionText.style.display = 'none';
  gameOverText.style.display = 'none';
  restartButton.style.display = 'none';
}

// Create a new canvas element
function createCanvas(): HTMLCanvasElement {
  // Remove old canvas if it exists
  const oldCanvas = document.getElementById("myCanvas");
  if (oldCanvas) {
    oldCanvas.remove();
  }

  // Create new canvas
  const newCanvas = document.createElement("canvas");
  newCanvas.id = "myCanvas";
  newCanvas.textContent = "Your browser does not support the canvas element.";
  canvasContainer.appendChild(newCanvas);

  return newCanvas;
}

// Set up grid callbacks and input handler for the current grid
function setupGridBindings(): void {
  grid.onGameStart = () => {
    isGameOver = false;
    hideOverlay();
    wakeLock.request();
    trackGameStart();
  };

  grid.onGameOver = () => {
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
    startNewSession();
  };

  // Re-attach input handler to the new grid
  if (inputHandler) {
    inputHandler.detach();
  }
  inputHandler = createInputHandler(config.input);
  inputHandler.attach(grid, renderer, grid);

  // Set restart callback for gamepad input
  if ('setRestartCallback' in inputHandler) {
    (inputHandler as any).setRestartCallback(() => restartGame());
  }
}

function restartGame(): void {
  if (!isGameOver) return;
  isGameOver = false;
  timer.reset();

  grid = new Grid(
    renderer,
    pointsElement,
    timer,
    config,
    currentSeed || undefined
  );
  setupGridBindings();
  grid.init();
  showStartUI();
}

// Initialize the game with a specific renderer
function initializeGame(rendererType: RendererType): void {
  // Clean up existing instances if they exist
  if (inputHandler) {
    inputHandler.detach();
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }

  // Update body class to reflect current renderer
  document.body.classList.remove('renderer-canvas2d', 'renderer-threejs');
  document.body.classList.add(`renderer-${rendererType}`);

  // Update config styles after body class is set (so CSS variables are correct)
  updateConfigStyles();

  // Create a fresh canvas element
  canvas = createCanvas();

  // Helper function to calculate canvas size based on renderer type
  const calculateCanvasSize = (): number => {
    const isMobile = window.innerWidth <= 768;
    if (rendererType === 'canvas2d') {
      // Check if mobile viewport
      console.log("width calculation", window.innerWidth, isMobile);
      if (isMobile) {
        // Mobile: Canvas always uses full viewport width
        return window.innerWidth;
      } else {
        // Desktop: Original calculation
        const verticalReserved = 192; // 12em at 16px/em
        const horizontalPadding = 64;  // 4em at 16px/em
        return Math.min(window.innerHeight - verticalReserved, window.innerWidth - horizontalPadding);
      }
    } else {
      if (isMobile) {
        // Mobile: Canvas always uses full viewport width
        return window.innerWidth;
      } else {
        // ThreeJS mode uses full viewport with minimal padding
        return Math.min(window.innerHeight - 64, window.innerWidth - 64);
      }
    }
  };

  // Set initial canvas size to be square and fill available space
  const size = calculateCanvasSize();
  canvas.width = size;
  canvas.height = size;

  // Create renderer based on config
  renderer = createRenderer(
    rendererType,
    canvas,
    config,
    timer
  );

  // Create resize handler
  resizeHandler = () => {
    const size = calculateCanvasSize();
    canvas.width = size;
    canvas.height = size;

    // Update Three.js camera if using ThreeJsRenderer
    if (renderer instanceof ThreeJsRenderer) {
      renderer.updateCameraAspect(canvas.width, canvas.height);
    }

    renderer.render();
  };
  window.addEventListener('resize', resizeHandler);

  // Create Grid with session seed
  grid = new Grid(
    renderer,
    pointsElement,
    timer,
    config,
    currentSeed || undefined
  );

  setupGridBindings();

  // Initialize the game
  grid.init();

  // Show start UI initially (before first rotation)
  showStartUI();
}

// Function to switch renderer
export function switchRenderer(newRenderer: RendererType): void {
  trackSettingsRenderer(newRenderer);
  saveRenderer(newRenderer);
  config.renderer = newRenderer;
  isGameOver = false;
  initializeGame(newRenderer);
}

// Function to switch input
export function switchInput(newInput: InputType): void {
  trackSettingsInput(newInput);
  saveInput(newInput);
  config.input = newInput;

  // Detach old input handler
  if (inputHandler) {
    inputHandler.detach();
  }

  // Create new input handler
  inputHandler = createInputHandler(newInput);
  inputHandler.attach(grid, renderer, grid);

  // Set restart callback for gamepad input
  if ('setRestartCallback' in inputHandler) {
    (inputHandler as any).setRestartCallback(() => restartGame());
  }

  // Update instruction text
  updateInstructionText(newInput);
}

// Function to update instruction text based on input type
function updateInstructionText(input: InputType): void {
  const instructionTexts: Record<InputType, string> = {
    keyboard: 'Get 3+ in a row. Use arrows to move. a, d to rotate. Rotate to begin timer.',
    gamepad: 'Get 3+ in a row. Use D-pad to move. Shoulder buttons to rotate. Start to restart. Rotate to begin timer.',
    touch: 'Get 3+ in a row. Tap to move cursor. Swipe left/right to rotate. Rotate to begin timer.'
  };

  instructionText.textContent = instructionTexts[input];
}

// Fetch session then initialize game
startNewSession().then(() => {
  initializeGame(config.renderer);
  updateInstructionText(config.input);
});

// Set up event listeners
restartButton.addEventListener('click', () => restartGame());

// Trophy button - open highscore board
const highscoreButton = document.getElementById('highscore-button');
if (highscoreButton) {
  highscoreButton.addEventListener('click', () => {
    highscoreUI.showBoard();
  });
}

// Initialize settings menu
new SettingsMenu(switchRenderer, switchInput);
