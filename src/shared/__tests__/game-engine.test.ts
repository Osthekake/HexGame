import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../game-engine';
import type { EngineConfig } from '../types';

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

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(defaultConfig, 12345);
    engine.init();
  });

  describe('init', () => {
    it('creates a 7x7 grid', () => {
      expect(engine.hexes.length).toBe(7);
      for (const row of engine.hexes) {
        expect(row.length).toBe(7);
      }
    });

    it('populates all cells with hexes', () => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const hex = engine.hexAt(x, y);
          expect(hex).toBeDefined();
          expect(hex!.colorIndex).toBeGreaterThanOrEqual(0);
          expect(hex!.colorIndex).toBeLessThan(10);
        }
      }
    });

    it('produces deterministic grids from the same seed', () => {
      const engine2 = new GameEngine(defaultConfig, 12345);
      engine2.init();

      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          expect(engine.hexAt(x, y)!.colorIndex).toBe(engine2.hexAt(x, y)!.colorIndex);
        }
      }
    });

    it('produces different grids from different seeds', () => {
      const engine2 = new GameEngine(defaultConfig, 99999);
      engine2.init();

      let hasDifference = false;
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          if (engine.hexAt(x, y)!.colorIndex !== engine2.hexAt(x, y)!.colorIndex) {
            hasDifference = true;
            break;
          }
        }
      }
      expect(hasDifference).toBe(true);
    });

    it('starts with score 0', () => {
      expect(engine.points).toBe(0);
    });

    it('starts with cursor at (3, 3)', () => {
      expect(engine.cursor).toEqual({ x: 3, y: 3 });
    });
  });

  describe('cursor movement', () => {
    it('moveLeft decrements x, clamped to 1', () => {
      engine.cursor = { x: 3, y: 3 };
      engine.moveLeft();
      expect(engine.cursor.x).toBe(2);

      // Clamp at 1
      engine.cursor = { x: 1, y: 3 };
      engine.moveLeft();
      expect(engine.cursor.x).toBe(1);
    });

    it('moveRight increments x, clamped to gridWidth - 2', () => {
      engine.cursor = { x: 3, y: 3 };
      engine.moveRight();
      expect(engine.cursor.x).toBe(4);

      // Clamp at 5 (7 - 2)
      engine.cursor = { x: 5, y: 3 };
      engine.moveRight();
      expect(engine.cursor.x).toBe(5);
    });

    it('moveUp decrements y, clamped to 1', () => {
      engine.cursor = { x: 3, y: 3 };
      engine.moveUp();
      expect(engine.cursor.y).toBe(2);

      engine.cursor = { x: 3, y: 1 };
      engine.moveUp();
      expect(engine.cursor.y).toBe(1);
    });

    it('moveDown increments y, clamped to gridHeight - 2', () => {
      engine.cursor = { x: 3, y: 3 };
      engine.moveDown();
      expect(engine.cursor.y).toBe(4);

      engine.cursor = { x: 3, y: 5 };
      engine.moveDown();
      expect(engine.cursor.y).toBe(5);
    });
  });

  describe('hexAt', () => {
    it('returns undefined for out-of-bounds coordinates', () => {
      expect(engine.hexAt(-1, 0)).toBeUndefined();
      expect(engine.hexAt(0, -1)).toBeUndefined();
      expect(engine.hexAt(7, 0)).toBeUndefined();
      expect(engine.hexAt(0, 7)).toBeUndefined();
    });

    it('returns hex for valid coordinates', () => {
      const hex = engine.hexAt(3, 3);
      expect(hex).toBeDefined();
      expect(hex!.id).toBeGreaterThan(0);
    });
  });

  describe('rotation', () => {
    it('swapClockwise rotates the 6 neighbors', () => {
      engine.cursor = { x: 3, y: 3 };

      // Capture the 6 neighbors before rotation
      const cx = 3, cy = 3;
      const before = {
        right: engine.hexAt(cx + 1, cy)!,
        left: engine.hexAt(cx - 1, cy)!,
        topleft: engine.hexAt(cx - cy % 2, cy - 1)!,
        topright: engine.hexAt(cx - cy % 2 + 1, cy - 1)!,
        bottomleft: engine.hexAt(cx - cy % 2, cy + 1)!,
        bottomright: engine.hexAt(cx - cy % 2 + 1, cy + 1)!,
      };

      engine.swapClockwise();

      // After clockwise: right = topright, left = bottomleft, etc.
      expect(engine.hexAt(cx + 1, cy)!.id).toBe(before.topright.id);
      expect(engine.hexAt(cx - 1, cy)!.id).toBe(before.bottomleft.id);
      expect(engine.hexAt(cx - cy % 2, cy - 1)!.id).toBe(before.left.id);
      expect(engine.hexAt(cx - cy % 2 + 1, cy - 1)!.id).toBe(before.topleft.id);
      expect(engine.hexAt(cx - cy % 2, cy + 1)!.id).toBe(before.bottomright.id);
      expect(engine.hexAt(cx - cy % 2 + 1, cy + 1)!.id).toBe(before.right.id);
    });

    it('swapCounterClockwise rotates the 6 neighbors', () => {
      engine.cursor = { x: 3, y: 3 };
      const cx = 3, cy = 3;

      const before = {
        right: engine.hexAt(cx + 1, cy)!,
        left: engine.hexAt(cx - 1, cy)!,
        topleft: engine.hexAt(cx - cy % 2, cy - 1)!,
        topright: engine.hexAt(cx - cy % 2 + 1, cy - 1)!,
        bottomleft: engine.hexAt(cx - cy % 2, cy + 1)!,
        bottomright: engine.hexAt(cx - cy % 2 + 1, cy + 1)!,
      };

      engine.swapCounterClockwise();

      // After counter-clockwise: right = bottomright, left = topleft, etc.
      expect(engine.hexAt(cx + 1, cy)!.id).toBe(before.bottomright.id);
      expect(engine.hexAt(cx - 1, cy)!.id).toBe(before.topleft.id);
      expect(engine.hexAt(cx - cy % 2, cy - 1)!.id).toBe(before.topright.id);
      expect(engine.hexAt(cx - cy % 2 + 1, cy - 1)!.id).toBe(before.right.id);
      expect(engine.hexAt(cx - cy % 2, cy + 1)!.id).toBe(before.left.id);
      expect(engine.hexAt(cx - cy % 2 + 1, cy + 1)!.id).toBe(before.bottomleft.id);
    });

    it('clockwise then counter-clockwise returns to original state', () => {
      engine.cursor = { x: 3, y: 3 };

      // Capture initial grid state
      const initialGrid = engine.hexes.map(row => row.map(h => h?.id));

      engine.swapClockwise();
      engine.swapCounterClockwise();

      const afterGrid = engine.hexes.map(row => row.map(h => h?.id));
      expect(afterGrid).toEqual(initialGrid);
    });
  });

  describe('findMatches', () => {
    it('detects horizontal 3-in-a-row', () => {
      // Set up a known horizontal match: same color at (2,3), (3,3), (4,3)
      engine.setHex(2, 3, { id: 901, colorIndex: 5 });
      engine.setHex(3, 3, { id: 902, colorIndex: 5 });
      engine.setHex(4, 3, { id: 903, colorIndex: 5 });

      // Make sure neighbors don't accidentally match
      engine.setHex(1, 3, { id: 904, colorIndex: 0 });
      engine.setHex(5, 3, { id: 905, colorIndex: 1 });

      const result = engine.findMatches();
      expect(result.comboCount).toBeGreaterThan(0);

      // The matched coordinates should include (2,3), (3,3), (4,3)
      const matchCoords = result.matched.map(c => `${c.x},${c.y}`);
      expect(matchCoords).toContain('3,3');
      // horizontal match at center (3,3): left=(2,3), right=(4,3)
      expect(matchCoords).toContain('2,3');
      expect(matchCoords).toContain('4,3');
    });
  });

  describe('scoring', () => {
    it('score formula: sum(combo^2 + 1) * chainLength^2', () => {
      // Manually set up chain to test the formula
      engine.chain = [4]; // combo=2, 2*2=4
      const result = engine.calculateChainScore();
      // (4+1) * 1^2 = 5
      expect(result.points).toBe(5);
    });

    it('chain with multiple steps', () => {
      engine.chain = [1, 4]; // two cascade steps
      const result = engine.calculateChainScore();
      // (1+1 + 4+1) * 2^2 = 7 * 4 = 28
      expect(result.points).toBe(28);
    });

    it('adds timer when points >= 6', () => {
      engine.chain = [1, 4];
      const result = engine.calculateChainScore();
      expect(result.points).toBe(28);
      expect(result.timerAdded).toBe(5000);
    });

    it('no timer added when points < 6', () => {
      engine.chain = [1]; // (1+1) * 1 = 2
      const result = engine.calculateChainScore();
      expect(result.points).toBe(2);
      expect(result.timerAdded).toBe(0);
    });

    it('resets chain after calculating score', () => {
      engine.chain = [1, 4];
      engine.calculateChainScore();
      expect(engine.chain).toEqual([]);
    });
  });

  describe('full rotation with cascade', () => {
    it('rotateClockwise returns a CascadeResult', () => {
      engine.cursor = { x: 3, y: 3 };
      const result = engine.rotateClockwise();

      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('totalPointsAwarded');
      expect(result).toHaveProperty('chainLength');
      expect(result).toHaveProperty('timerAdded');
      expect(result).toHaveProperty('holdTime');
      expect(result.totalPointsAwarded).toBeGreaterThanOrEqual(0);
    });

    it('is deterministic: same seed and actions produce same score', () => {
      const engine2 = new GameEngine(defaultConfig, 12345);
      engine2.init();

      engine.cursor = { x: 3, y: 3 };
      engine2.cursor = { x: 3, y: 3 };

      engine.rotateClockwise();
      engine.moveRight();
      engine.rotateCounterClockwise();

      engine2.rotateClockwise();
      engine2.moveRight();
      engine2.rotateCounterClockwise();

      expect(engine.points).toBe(engine2.points);
      // Grids should be identical
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          expect(engine.hexAt(x, y)?.colorIndex).toBe(engine2.hexAt(x, y)?.colorIndex);
        }
      }
    });
  });
});
