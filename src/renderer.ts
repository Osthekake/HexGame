import { Coordinate, Hex } from "./grid";

export interface HexRenderer {
  reset(): void
  // Basic rendering
  render(): void;
  setHexPosition(gridX: number, gridY: number, hex: Hex): void;
  setCursorPosition(gridX: number, gridY: number): void;
  drawText(text: string, centerGridX: number, centerGridY: number, fontSize: number, fillStyle: string | CanvasGradient): void;
  //animations
  animateVanish(uniq: (Hex | undefined)[]): Promise<void>;
  animateShowText(calculatedPoints: number, text: string): Promise<void>;
  animateRotate(clockwise: boolean, cursor: Coordinate, hexes: (Hex | undefined)[]): Promise<void>;
  animateShiftLeft(shiftedUniq: (Coordinate & { distance: number; })[]): Promise<void>;

  // Color lookup helper (moved from Grid)
  getColorForHex(hexValue: number): string;

  // Gradient creation helper
  //createHorizontalGradient(colorStops: Array<{ offset: number; color: string }>): CanvasGradient;
}

