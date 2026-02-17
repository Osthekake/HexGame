import { replayGame } from '../../src/shared/replay.js';
import type { GameAction, EngineConfig } from '../../src/shared/types.js';

const GAME_CONFIG: EngineConfig = {
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

export function validateScore(seed: number, actions: GameAction[], claimedScore: number) {
  return replayGame(GAME_CONFIG, seed, actions, claimedScore);
}
