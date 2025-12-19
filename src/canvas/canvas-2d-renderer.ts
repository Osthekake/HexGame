import { GameConfig } from "../config";
import { Hex } from "../grid";
import { HexRenderer, HexTransform } from "../renderer";

export class Canvas2DRenderer implements HexRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hexesWide: number;
  private hexesHigh: number;
  private colors: string[];
  private cursorColor: string;

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
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
    const pixel = this.gridToPixel(gridX, gridY);
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

  setHexPosition(gridX: number, gridY: number, hex: Hex, transform?: HexTransform): void {
    const color = this.getColorForHex(hex.colorIndex)
    console.log('draw hex', hex)
    if (!transform || transform.type === 'normal') {
      const pixel = this.gridToPixel(gridX, gridY);
      this.drawHexAtPixel(pixel.x, pixel.y, 1, color);
    } else if (transform.type === 'rotate') {
      this.drawHexRotating(gridX, gridY, color, transform);
    } else if (transform.type === 'shift') {
      this.drawHexShifting(gridX, gridY, color, transform);
    } else if (transform.type === 'vanish') {
      this.drawHexVanishing(gridX, gridY, color, transform);
    }
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

  private drawHexRotating(gridX: number, gridY: number, color: string, transform: HexTransform): void {
    if (transform.centerGridX === undefined || transform.centerGridY === undefined ||
        transform.progress === undefined || transform.clockwise === undefined ||
        transform.rotationIndex === undefined) {
      return;
    }

    const centerPixel = this.gridToPixel(transform.centerGridX, transform.centerGridY);
    const radius = this.canvas.width / this.hexesWide;
    const totalAngle = Math.PI / 3; // 60 degrees

    // Calculate rotation angle based on progress
    let angle = transform.progress * totalAngle;
    if (transform.clockwise) {
      angle = -angle;
    }

    // Start at 30 degrees and add the hex's position in the rotation cycle
    angle += Math.PI / 6 + (transform.rotationIndex * Math.PI / 3);

    const hexX = centerPixel.x + Math.sin(angle) * radius;
    const hexY = centerPixel.y + Math.cos(angle) * radius;
    this.drawHexAtPixel(hexX, hexY, 1, color);
  }

  private drawHexShifting(gridX: number, gridY: number, color: string, transform: HexTransform): void {
    if (transform.distance === undefined || transform.progress === undefined) {
      return;
    }

    const pixel = this.gridToPixel(gridX, gridY);
    const tileWidth = this.canvas.width / this.hexesWide;
    const offset = transform.progress * tileWidth * transform.distance;

    this.drawHexAtPixel(pixel.x - offset, pixel.y, 1, color);
  }

  private drawHexVanishing(gridX: number, gridY: number, color: string, transform: HexTransform): void {
    if (transform.progress === undefined) {
      return;
    }

    const pixel = this.gridToPixel(gridX, gridY);
    const scale = 1 - transform.progress;
    this.drawHexAtPixel(pixel.x, pixel.y, scale, color);
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

  public render() {
    
  }
}