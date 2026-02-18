import { describe, it, expect } from 'vitest';
import { replayGame } from '../replay';
import { GameEngine } from '../game-engine';
import type { EngineConfig, GameAction } from '../types';
import { liveGame as liveGame260 } from './fixtures/live-game-260';
import { liveGame as liveGame284 } from './fixtures/live-game-284';
import { liveGame as liveGame1159 } from './fixtures/live-game-1159';

const defaultConfig: EngineConfig = {
  gridWidth: 7,
  gridHeight: 7,
  numberOfColors: 10,
  timerMax: 30000,
  animationTimes: {
    rotate: 400,
    vanish: 400,
    shift: 400,
    text: 600,
  },
};

describe('replayGame', () => {
  it('validates a correct game with matching score', () => {
    const seed = 12345;
    const engine = new GameEngine(defaultConfig, seed);
    engine.init();

    const actions: GameAction[] = [];

    actions.push({ type: 'rotateClockwise', timestamp: 0 });
    engine.rotateClockwise();

    engine.moveRight();
    actions.push({ type: 'moveCursor', timestamp: 100, x: engine.cursor.x, y: engine.cursor.y });

    actions.push({ type: 'rotateCounterClockwise', timestamp: 200 });
    engine.rotateCounterClockwise();

    engine.moveLeft();
    actions.push({ type: 'moveCursor', timestamp: 300, x: engine.cursor.x, y: engine.cursor.y });

    actions.push({ type: 'rotateClockwise', timestamp: 400 });
    engine.rotateClockwise();

    const result = replayGame(defaultConfig, seed, actions, engine.points);
    expect(result.valid).toBe(true);
    expect(result.calculatedScore).toBe(engine.points);
  });

  it('rejects tampered score', () => {
    const seed = 12345;
    const engine = new GameEngine(defaultConfig, seed);
    engine.init();

    const actions: GameAction[] = [
      { type: 'rotateClockwise', timestamp: 0 },
    ];
    engine.rotateClockwise();

    const result = replayGame(defaultConfig, seed, actions, engine.points + 1000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Score mismatch');
  });

  it('rejects out-of-order timestamps', () => {
    const seed = 12345;
    const actions: GameAction[] = [
      { type: 'rotateClockwise', timestamp: 500 },
      { type: 'rotateClockwise', timestamp: 200 }, // before previous
    ];

    const result = replayGame(defaultConfig, seed, actions, 0);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('timestamp');
  });

  it('rejects actions after timer expiry', () => {
    const seed = 12345;
    const actions: GameAction[] = [
      { type: 'rotateClockwise', timestamp: 0 },
      // Timer is 30000ms. After hold time compensation, this should be way past expiry.
      { type: 'rotateClockwise', timestamp: 60000 },
    ];

    const result = replayGame(defaultConfig, seed, actions, 0);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Timer expired');
  });

  it('accepts an empty game with 0 score', () => {
    const result = replayGame(defaultConfig, 12345, [], 0);
    expect(result.valid).toBe(true);
    expect(result.calculatedScore).toBe(0);
  });

  it('accepts moveCursor-only games with 0 score', () => {
    const actions: GameAction[] = [
      { type: 'moveCursor', timestamp: 0, x: 2, y: 3 },
      { type: 'moveCursor', timestamp: 100, x: 3, y: 3 },
      { type: 'moveCursor', timestamp: 200, x: 3, y: 2 },
      { type: 'moveCursor', timestamp: 300, x: 3, y: 3 },
    ];

    const result = replayGame(defaultConfig, 12345, actions, 0);
    expect(result.valid).toBe(true);
    expect(result.calculatedScore).toBe(0);
  });

  it('validates a game using moveCursor to position before rotations', () => {
    const seed = 12345;
    const engine = new GameEngine(defaultConfig, seed);
    engine.init();

    const actions: GameAction[] = [];

    engine.moveCursor(2, 3);
    actions.push({ type: 'moveCursor', timestamp: 0, x: 2, y: 3 });

    actions.push({ type: 'rotateClockwise', timestamp: 100 });
    engine.rotateClockwise();

    engine.moveCursor(4, 4);
    actions.push({ type: 'moveCursor', timestamp: 200, x: 4, y: 4 });

    actions.push({ type: 'rotateCounterClockwise', timestamp: 300 });
    engine.rotateCounterClockwise();

    const result = replayGame(defaultConfig, seed, actions, engine.points);
    expect(result.valid).toBe(true);
    expect(result.calculatedScore).toBe(engine.points);
  });

  [liveGame260, liveGame284, liveGame1159].forEach(liveGame => {
    const score = liveGame.score
    it(`validates live score of ${score} with recorded seed and actions`, () => {
      const result = replayGame(defaultConfig, liveGame.seed, liveGame.actions, liveGame.score);
      expect(result.valid).toBe(true);
      expect(result.calculatedScore).toBe(liveGame.score);
    });
  
    it(`rejects live score of ${score} with a different seed`, () => {
      const result = replayGame(defaultConfig, liveGame.seed + 1, liveGame.actions, liveGame.score);
      expect(result.valid).toBe(false);
    });
  })


  it('replay is deterministic across multiple runs', () => {
    const seed = 42;
    const engine = new GameEngine(defaultConfig, seed);
    engine.init();

    const actions: GameAction[] = [];
    for (let i = 0; i < 10; i++) {
      actions.push({ type: 'rotateClockwise', timestamp: i * 500 });
      engine.rotateClockwise();
      engine.moveRight();
      actions.push({ type: 'moveCursor', timestamp: i * 500 + 100, x: engine.cursor.x, y: engine.cursor.y });
    }

    const result1 = replayGame(defaultConfig, seed, actions, engine.points);
    const result2 = replayGame(defaultConfig, seed, actions, engine.points);

    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
    expect(result1.calculatedScore).toBe(result2.calculatedScore);
  });
});
