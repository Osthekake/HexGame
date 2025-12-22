import { Grid } from './grid';
import { Timer, Bar } from './timer';
import { HighScore } from './highscore';
import { config, createRenderer, createInputHandler } from './config';
import  './main.css'

// Get DOM elements
const canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
if (!canvas) {
  throw new Error("Canvas element not found");
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



// Create instances
const bar = new Bar(timeElement);
bar.render(100);

const timer = new Timer(bar, config.timer.maxTime, config.timer.increment);
const highScore = new HighScore(config.highscoreEnabled);

// Set initial canvas size to be square and fill available space
const size = Math.min(window.innerHeight - 64, window.innerWidth - 64);
canvas.width = size;
canvas.height = size;

// Create renderer based on config
const renderer = createRenderer(
  config.renderer,
  canvas,
  config,
  timer
);

// Resize canvas on window resize
window.addEventListener('resize', () => {
  const size = Math.min(window.innerHeight - 64, window.innerWidth - 64);
  canvas.width = size;
  canvas.height = size;
  renderer.render();
});

// Create Grid (Animation is created internally)
const grid = new Grid(
  renderer,
  pointsElement,
  timer,
  highScore,
  config
);

// Initialize input controls based on config
const inputHandler = createInputHandler(config.input);
inputHandler.attach(grid);

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
