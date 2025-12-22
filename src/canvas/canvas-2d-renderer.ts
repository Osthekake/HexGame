import { GameConfig } from "../config";
import { Coordinate, Hex } from "../grid";
import { HexRenderer } from "../renderer";
import { GameTimer } from "../timer";
import { canvasAnimationPromise } from "./canvas-animation";

export class Canvas2DRenderer implements HexRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hexesWide: number;
  private hexesHigh: number;
  private colors: string[];
  private cursorColor: string;
  private hexPositions: Map<number, { gridX: number; gridY: number; hex: Hex }> = new Map();
  private cursorPosition: { gridX: number; gridY: number } | null = null;

  constructor(canvas: HTMLCanvasElement, private config: GameConfig, private timer: GameTimer) {
    this.canvas = canvas;
    canvas.width = config.canvas.width
    canvas.height = config.canvas.height
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");
    this.ctx = ctx;
    this.hexesWide = config.grid.width;
    this.hexesHigh = config.grid.height;
    this.colors = config.colors;
    this.cursorColor = config.cursorColor;
  }
  reset() {
    this.hexPositions.clear()
  }

  getColorForHex(hexValue: number): string {
    if (hexValue < 0) {
      return "transparent";
    }
    return this.colors[hexValue];
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setCursorPosition(gridX: number, gridY: number): void {
    this.cursorPosition = { gridX, gridY };
  }

  setHexPosition(gridX: number, gridY: number, hex: Hex): void {
    this.hexPositions.set(hex.id, { gridX, gridY, hex });
  }

  drawText(text: string, centerGridX: number, centerGridY: number, fontSize: number, fillStyle: string | CanvasGradient): void {
    const pixel = this.gridToPixel(centerGridX, centerGridY);
    const textWidth = fontSize * 2;

    this.ctx.font = fontSize + "px Verdana";
    this.ctx.fillStyle = fillStyle;
    this.ctx.fillText(text, pixel.x - textWidth * 0.4, pixel.y - fontSize * 0.1);
  }

  createHorizontalGradient(colorStops: Array<{ offset: number; color: string }>): CanvasGradient {
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
    for (const stop of colorStops) {
      gradient.addColorStop(stop.offset, stop.color);
    }
    return gradient;
  }

  private drawHexAtPixel(centerX: number, centerY: number, scale: number, fillStyle: string): void {
    const radius = this.getHexRadius() * scale;

    this.ctx.fillStyle = fillStyle;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY + radius);
    for (let i = 0; i < 6; i++) {
      const radians = Math.PI * i / 3;
      this.ctx.lineTo(
        centerX + Math.sin(radians) * radius,
        centerY + Math.cos(radians) * radius
      );
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  private gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
    const tileWidth = this.canvas.width / this.hexesWide;
    const tileHeight = (this.canvas.height / this.hexesHigh) * 0.85;
    const radius = tileWidth / 2;
    const centerX = gridX * tileWidth + radius * (1 + (gridY + 1) % 2);
    const centerY = gridY * tileHeight + radius + 25;
    return { x: centerX, y: centerY };
  }

  private getHexRadius(): number {
    return this.canvas.width / this.hexesWide / 2;
  }

  private drawAllHexes(excludeIds?: Set<number>): void {
    for (const [id, { gridX, gridY, hex }] of this.hexPositions) {
      if (excludeIds && excludeIds.has(id)) {
        continue;
      }
      const color = this.getColorForHex(hex.colorIndex);
      const pixel = this.gridToPixel(gridX, gridY);
      this.drawHexAtPixel(pixel.x, pixel.y, 1, color);
    }
  }

  private drawCursor(): void {
    if (!this.cursorPosition) return;

    const pixel = this.gridToPixel(this.cursorPosition.gridX, this.cursorPosition.gridY);
    const radius = this.getHexRadius();

    this.ctx.save();
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = this.cursorColor;
    this.ctx.beginPath();
    this.ctx.moveTo(pixel.x, pixel.y + radius + 5);
    for (let i = 0; i < 6; i++) {
      const radians = Math.PI * i / 3;
      this.ctx.lineTo(
        pixel.x + Math.sin(radians) * (radius + 5),
        pixel.y + Math.cos(radians) * (radius + 5)
      );
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
  }

  public render() {
    this.clear();
    this.drawAllHexes();
    this.drawCursor();
  }

  animateVanish(uniq: (Hex | undefined)[]): Promise<void> {
    return canvasAnimationPromise(this.timer, this.config.animation.vanishAnimationTime, (fraction) => {
      this.clear();

      const vanishingIds = new Set(uniq.filter(h => h !== undefined).map(h => h!.id));
      this.drawAllHexes(vanishingIds);

      const scale = 1 - fraction;
      for (const hex of uniq) {
        if (hex) {
          const pos = this.hexPositions.get(hex.id);
          if (pos) {
            const color = this.getColorForHex(hex.colorIndex);
            const pixel = this.gridToPixel(pos.gridX, pos.gridY);
            this.drawHexAtPixel(pixel.x, pixel.y, scale, color);
          }
        }
      }
    }).then(() => {
      uniq.forEach(hex => hex && this.hexPositions.delete(hex.id))
    })
  }
  animateShowText(calculatedPoints: number, text: string): Promise<void> {
    return canvasAnimationPromise(this.timer, this.config.animation.textAnimationTime, (fraction) => {
      this.clear();
      this.drawAllHexes();

      const textHeight = Math.round(5 + fraction * calculatedPoints * 5);
      const gradientFill = this.createHorizontalGradient([
        { offset: 0, color: "magenta" },
        { offset: 0.5, color: "blue" },
        { offset: 1.0, color: "red" }
      ]);

      const centerX = 3.5;
      const centerY = 3.5;
      this.drawText(String(calculatedPoints), centerX, centerY, textHeight, gradientFill);
    })
  }
  animateRotate(clockwise: boolean, cursor: Coordinate, hexes: (Hex | undefined)[]): Promise<void> {
     return canvasAnimationPromise(this.timer, this.config.animation.rotateAnimationTime, (fraction) => {
      this.clear();

      const rotatingIds = new Set(hexes.filter(h => h !== undefined).map(h => h!.id));
      this.drawAllHexes(rotatingIds);

      const cursorPixel = this.gridToPixel(cursor.x, cursor.y);
      const angleStep = (Math.PI * 2) / 6;
      const rotationAngle = (clockwise ? 1 : -1) * angleStep * fraction;

      for (let i = 0; i < hexes.length; i++) {
        const hex = hexes[i];
        if (hex) {
          const pos = this.hexPositions.get(hex.id);
          if (pos) {
            const startPixel = this.gridToPixel(pos.gridX, pos.gridY);
            const dx = startPixel.x - cursorPixel.x;
            const dy = startPixel.y - cursorPixel.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const startAngle = Math.atan2(dy, dx);
            const newAngle = startAngle + rotationAngle;
            const newX = cursorPixel.x + Math.cos(newAngle) * distance;
            const newY = cursorPixel.y + Math.sin(newAngle) * distance;

            const color = this.getColorForHex(hex.colorIndex);
            this.drawHexAtPixel(newX, newY, 1, color);
          }
        }
      }
    })
  }
  animateShiftLeft(shiftedUniq: (Coordinate & { distance: number; })[]): Promise<void> {
     return canvasAnimationPromise(this.timer, this.config.animation.shiftAnimationTime, (fraction) => {
      this.clear();

      const shiftingCoords = new Map<number, number>();
      for (const coord of shiftedUniq) {
        for (const [id, pos] of this.hexPositions) {
          if (pos.gridX === coord.x && pos.gridY === coord.y) {
            shiftingCoords.set(id, coord.distance);
          }
        }
      }

      this.drawAllHexes(new Set(shiftingCoords.keys()));

      for (const [id, distance] of shiftingCoords) {
        const pos = this.hexPositions.get(id);
        if (pos) {
          const startPixel = this.gridToPixel(pos.gridX, pos.gridY);
          const endPixel = this.gridToPixel(pos.gridX - distance, pos.gridY);
          const currentX = startPixel.x + (endPixel.x - startPixel.x) * fraction;
          const currentY = startPixel.y + (endPixel.y - startPixel.y) * fraction;

          const color = this.getColorForHex(pos.hex.colorIndex);
          this.drawHexAtPixel(currentX, currentY, 1, color);
        }
      }
    })
  }
}