import { GameConfig } from "../config";
import { Hex } from "../grid";
import { HexRenderer, HexTransform } from "../renderer";
import {Camera, Color, CylinderGeometry, Material, Mesh, MeshBasicMaterial, MeshPhongMaterial, PerspectiveCamera, PointLight, Scene, WebGLRenderer} from 'three'

export class ThreeJsRenderer implements HexRenderer {
    scene: Scene
    camera: Camera
    renderer: WebGLRenderer
    cursorLight: PointLight

    tileWidth: number
    tileHeight: number

    materials: Record<number, Material>
    hexGeometry: CylinderGeometry

    meshes: Record<number, Mesh>

    constructor(canvas: HTMLCanvasElement, config: GameConfig){
        this.scene = new Scene()
        this.scene.background = new Color(config.backgroundColor)
        this.camera = new PerspectiveCamera(75, config.canvas.width / config.canvas.height, 0.1, 100)
        this.cursorLight = new PointLight()

        this.tileWidth = 2//config.canvas.width / config.grid.width
        this.tileHeight = 2*0.85//config.canvas.height / config.grid.height * 0.85
        this.renderer = new WebGLRenderer({canvas})
        this.renderer.setSize(config.canvas.width, config.canvas.height)

        this.materials = {}
        config.colors.forEach((color, i) => this.addMaterial(i, color))

        const radius = this.tileWidth / 2
        this.hexGeometry = new CylinderGeometry(radius, radius, 0.5, 6,)

        this.meshes = {}
    }

    private addMaterial(colorIndex: number, color: string) {
        const material = new MeshPhongMaterial({
            emissive: color,
            shininess: 100,
            color})
        this.materials[colorIndex] = material
    }

    private addMesh(hex: Hex) {
        const material = this.materials[hex.colorIndex]
        const mesh = new Mesh(this.hexGeometry, material)
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.y = 0//Math.PI / 2;
        mesh.rotation.z = 0// Math.PI / 6;
        this.meshes[hex.id] = mesh
        this.scene.add(mesh)
        return mesh
    }

    private getOrCreateMesh(hex: Hex) {
        const existing = this.meshes[hex.id]
        if(existing)
            return existing
        return this.addMesh(hex)
    }

    private gridToPosition(gridX: number, gridY: number): { x: number; y: number } {
        const radius = this.tileWidth / 2;
        const centerX = gridX * this.tileWidth + radius * (1 + (gridY + 1) % 2) - 5;
        const centerY = gridY * this.tileHeight + radius -6;
        return { x: centerX, y: centerY };
    }

    clear(): void {
        // not needed I think
    }
    render(){
        this.renderer.render(this.scene, this.camera)
    }
    setHexPosition(gridX: number, gridY: number, hex: Hex, transform?: HexTransform): void {
        const mesh = this.getOrCreateMesh(hex)
        const pos = this.gridToPosition(gridX, gridY)
        mesh.position.set( 
            pos.x, 
            pos.y, 
            -11
        )
        console.log('set hex position', gridX, gridY, mesh.position)
    }
    setCursorPosition(gridX: number, gridY: number): void {
        const pos = this.gridToPosition(gridX, gridY)
        this.cursorLight.position.set(
            pos.x,
            pos.y,
            -10
        )
        console.log('set cursor position', gridX, gridY, this.cursorLight.position)
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