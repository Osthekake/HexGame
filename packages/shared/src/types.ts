export interface Hex {
  id: number;
  colorIndex: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export type ActionType =
  | 'rotateClockwise'
  | 'rotateCounterClockwise'
  | 'moveCursor';

export type GameAction =
  | { type: Exclude<ActionType, 'moveCursor'>; timestamp: number }
  | { type: 'moveCursor'; timestamp: number; x: number; y: number };

export interface EngineConfig {
  gridWidth: number;       // 7
  gridHeight: number;      // 7
  numberOfColors: number;  // 10
  timerMax: number;        // 30000
  animationTimes: {
    rotate: number;   // 400
    vanish: number;   // 400
    shift: number;    // 400
    text: number;     // 600
  };
}

export interface MatchResult {
  matched: Coordinate[];
  comboCount: number;
}

export interface ShiftResult {
  shifted: (Coordinate & { distance: number })[];
}

export interface CascadeStep {
  matches: MatchResult;
  removedHexIds: number[];
  newHexes: Array<{ hex: Hex; coord: Coordinate }>;
  shift: ShiftResult;
}

export interface CascadeResult {
  steps: CascadeStep[];
  totalPointsAwarded: number;
  chainLength: number;
  timerAdded: number;          // ms added (5000 if points >= 6, else 0)
  holdTime: number;            // total animation hold time for this cascade
  rotatedHexes?: {
    before: (Hex | undefined)[];
    cursor: Coordinate;
    clockwise: boolean;
  };
}

export interface ReplayResult {
  valid: boolean;
  calculatedScore: number;
  reason?: string;
}
