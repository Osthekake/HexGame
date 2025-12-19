import { Coordinate } from "./grid";

export interface AnimationSystem {
  rotate(clockwise: boolean, center: Coordinate): Promise<void>;
  vanish(hexes: Coordinate[]): Promise<void>;
  shiftLeft(hexes: Array<Coordinate & { distance: number }>): Promise<void>;
  showText(chain: number, kind: string): Promise<void>;
}