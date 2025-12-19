import { Hex } from "../grid";
import { HexRenderer, HexTransform } from "../renderer";

export class ThreeJsRenderer implements HexRenderer {
    clear(): void {
        throw new Error("Method not implemented.");
    }
    setHexPosition(gridX: number, gridY: number, hex: Hex, transform?: HexTransform): void {
        throw new Error("Method not implemented.");
    }
    setCursorPosition(gridX: number, gridY: number): void {
        throw new Error("Method not implemented.");
    }
    drawText(text: string, centerGridX: number, centerGridY: number, fontSize: number, fillStyle: string | CanvasGradient): void {
        throw new Error("Method not implemented.");
    }
    getColorForHex(hexValue: number): string {
        throw new Error("Method not implemented.");
    }
    createHorizontalGradient(colorStops: Array<{ offset: number; color: string; }>): CanvasGradient {
        throw new Error("Method not implemented.");
    }


}