import { GameEngine } from './game-engine';
import type { EngineConfig, GameAction, ReplayResult } from './types';

export function replayGame(
  config: EngineConfig,
  seed: number,
  actions: GameAction[],
  claimedScore: number
): ReplayResult {
  const engine = new GameEngine(config, seed);
  engine.init();

  let gameStarted = false;
  let timerRemaining = config.timerMax;
  let prevTimestamp = 0;
  let pendingHoldTime = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Validate monotonically increasing timestamps
    if (action.timestamp < prevTimestamp) {
      return {
        valid: false,
        calculatedScore: engine.points,
        reason: `Action ${i} timestamp ${action.timestamp} is before previous ${prevTimestamp}`,
      };
    }

    if (gameStarted) {
      // Compute elapsed real time
      const elapsed = action.timestamp - prevTimestamp;
      timerRemaining -= elapsed;

      // Compensate for animation hold time from previous cascade
      timerRemaining += pendingHoldTime;
      pendingHoldTime = 0;

      if (timerRemaining <= 0) {
        return {
          valid: false,
          calculatedScore: engine.points,
          reason: `Timer expired at action ${i} (timestamp ${action.timestamp})`,
        };
      }
    }

    prevTimestamp = action.timestamp;

    // Execute the action
    switch (action.type) {
      case 'moveLeft':
        engine.moveLeft();
        break;
      case 'moveRight':
        engine.moveRight();
        break;
      case 'moveUp':
        engine.moveUp();
        break;
      case 'moveDown':
        engine.moveDown();
        break;
      case 'rotateClockwise': {
        if (!gameStarted) gameStarted = true;
        const result = engine.rotateClockwise();
        pendingHoldTime = result.holdTime;
        timerRemaining += result.timerAdded;
        break;
      }
      case 'rotateCounterClockwise': {
        if (!gameStarted) gameStarted = true;
        const result = engine.rotateCounterClockwise();
        pendingHoldTime = result.holdTime;
        timerRemaining += result.timerAdded;
        break;
      }
    }
  }

  if (engine.points !== claimedScore) {
    return {
      valid: false,
      calculatedScore: engine.points,
      reason: `Score mismatch: claimed ${claimedScore}, calculated ${engine.points}`,
    };
  }

  return {
    valid: true,
    calculatedScore: engine.points,
  };
}
