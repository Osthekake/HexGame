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



// Create instances
const bar = new Bar(timeElement);
bar.render(100);

const timer = new Timer(bar, config.timer.maxTime, config.timer.increment);
const highScore = new HighScore(config.highscoreEnabled);

// Create renderer based on config
const renderer = createRenderer(
  config.renderer,
  canvas,
  config
);

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

// Initialize the game
grid.init();

// Set up event listeners
const restartButton = document.getElementById("restart-button");
if (restartButton) {
  restartButton.addEventListener('click', () => {
    grid.init();
  });
}

const clearHighscoreButton = document.getElementById("clear-highscore");
if (clearHighscoreButton) {
  clearHighscoreButton.addEventListener('click', () => {
    highScore.clear();
  });
}
