import { Hex } from "./grid";

export interface HexTransform {
  type: 'normal' | 'rotate' | 'shift' | 'vanish';
  // For rotate
  centerGridX?: number;
  centerGridY?: number;
  progress?: number;
  clockwise?: boolean;
  rotationIndex?: number; // Which position in the 6-hex rotation (0-5)
  // For shift
  distance?: number;
  // For vanish (uses progress)
}

export interface HexRenderer {
  // Basic rendering
  clear(): void;
  setHexPosition(gridX: number, gridY: number, hex: Hex, transform?: HexTransform): void;
  setCursorPosition(gridX: number, gridY: number): void;
  drawText(text: string, centerGridX: number, centerGridY: number, fontSize: number, fillStyle: string | CanvasGradient): void;

  // Color lookup helper (moved from Grid)
  getColorForHex(hexValue: number): string;

  // Gradient creation helper
  createHorizontalGradient(colorStops: Array<{ offset: number; color: string }>): CanvasGradient;
}

