import { Grid } from './grid';
import { Timer, Bar } from './timer';
import { HighScore } from './highscore';
import { config, createRenderer, createInputHandler, saveRenderer, updateConfigStyles } from './config';
import { SettingsMenu } from './settings';
import type { RendererType } from './config';
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

// Game state
let renderer: HexRenderer;
let grid: Grid;
let inputHandler: InputHandler;
let resizeHandler: () => void;
let canvas: HTMLCanvasElement;

// Persistent instances
const bar = new Bar(timeElement);
bar.render(100);

const timer = new Timer(bar, config.timer.maxTime, config.timer.increment);
const highScore = new HighScore(config.highscoreEnabled);

// Overlay visibility control
function showGameOverUI(): void {
  instructionText.style.display = 'none';
  restartButton.style.display = 'block';
}

function showStartUI(): void {
  instructionText.style.display = 'block';
  restartButton.style.display = 'none';
}

function hideOverlay(): void {
  instructionText.style.display = 'none';
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

  // Set initial canvas size to be square and fill available space
  const size = Math.min(window.innerHeight - 64, window.innerWidth - 64);
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
    const size = Math.min(window.innerHeight - 64, window.innerWidth - 64);
    canvas.width = size;
    canvas.height = size;
    renderer.render();
  };
  window.addEventListener('resize', resizeHandler);

  // Create Grid (Animation is created internally)
  grid = new Grid(
    renderer,
    pointsElement,
    timer,
    highScore,
    config
  );

  // Initialize input controls based on config
  inputHandler = createInputHandler(config.input);
  inputHandler.attach(grid);

  // Set up game state callbacks
  grid.onGameStart = () => {
    hideOverlay();
  };

  grid.onGameOver = () => {
    showGameOverUI();
  };

  // Initialize the game
  grid.init();

  // Show start UI initially (before first rotation)
  showStartUI();
}

// Function to switch renderer
export function switchRenderer(newRenderer: RendererType): void {
  saveRenderer(newRenderer);
  (config as any).renderer = newRenderer;
  initializeGame(newRenderer);
}

// Initialize with current renderer
initializeGame(config.renderer);

// Set up event listeners
restartButton.addEventListener('click', () => {
  grid.init();
  showStartUI();
});

const clearHighscoreButton = document.getElementById("clear-highscore");
if (clearHighscoreButton) {
  clearHighscoreButton.addEventListener('click', () => {
    highScore.clear();
  });
}

// Initialize settings menu
new SettingsMenu(switchRenderer);
