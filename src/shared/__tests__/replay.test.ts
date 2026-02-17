import { describe, it, expect } from 'vitest';
import { replayGame } from '../replay';
import { GameEngine } from '../game-engine';
import type { EngineConfig, GameAction } from '../types';

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

    // Perform some rotations and record them
    actions.push({ type: 'rotateClockwise', timestamp: 0 });
    engine.rotateClockwise();

    actions.push({ type: 'moveRight', timestamp: 100 });
    engine.moveRight();

    actions.push({ type: 'rotateCounterClockwise', timestamp: 200 });
    engine.rotateCounterClockwise();

    actions.push({ type: 'moveLeft', timestamp: 300 });
    engine.moveLeft();

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

  it('accepts movement-only games with 0 score', () => {
    const actions: GameAction[] = [
      { type: 'moveLeft', timestamp: 0 },
      { type: 'moveRight', timestamp: 100 },
      { type: 'moveUp', timestamp: 200 },
      { type: 'moveDown', timestamp: 300 },
    ];

    const result = replayGame(defaultConfig, 12345, actions, 0);
    expect(result.valid).toBe(true);
    expect(result.calculatedScore).toBe(0);
  });

  it('replay is deterministic across multiple runs', () => {
    const seed = 42;
    const engine = new GameEngine(defaultConfig, seed);
    engine.init();

    const actions: GameAction[] = [];
    for (let i = 0; i < 10; i++) {
      actions.push({ type: 'rotateClockwise', timestamp: i * 500 });
      engine.rotateClockwise();
      actions.push({ type: 'moveRight', timestamp: i * 500 + 100 });
      engine.moveRight();
    }

    const result1 = replayGame(defaultConfig, seed, actions, engine.points);
    const result2 = replayGame(defaultConfig, seed, actions, engine.points);

    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
    expect(result1.calculatedScore).toBe(result2.calculatedScore);
  });
});
