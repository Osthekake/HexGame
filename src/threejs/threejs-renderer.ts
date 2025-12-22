import { GameConfig } from "../config";
import { Coordinate, Hex } from "../grid";
import { HexRenderer } from "../renderer";
import { GameTimer } from "../timer";
import {
    Camera, Color, CylinderGeometry, Material, Mesh, MeshPhongMaterial,
    PerspectiveCamera, PointLight, Scene, WebGLRenderer, TorusGeometry,
    AmbientLight, Vector3
} from 'three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import * as TWEEN from '@tweenjs/tween.js'
import { Group } from '@tweenjs/tween.js'
import { tweenPromise } from './tween-promise'
import { HexBevelMaterial } from './hex-bevel-material'

export class ThreeJsRenderer implements HexRenderer {
    scene: Scene
    camera: Camera
    renderer: WebGLRenderer
    cursorLight: PointLight
    cursorTorus: Mesh

    tileWidth: number
    tileHeight: number

    materials: Record<number, Material>
    hexGeometry: CylinderGeometry

    meshes: Record<number, Mesh>
    hexPositions: Map<number, { gridX: number; gridY: number;}> = new Map()

    private config: GameConfig
    private timer: GameTimer
    private font: Font | null = null
    private textMeshes: Mesh[] = []
    private animatingHexes: Set<number> = new Set()
    private cursorTweenGroup: Group = new Group()

    constructor(canvas: HTMLCanvasElement, config: GameConfig, timer: GameTimer){
        this.config = config
        this.timer = timer
        this.scene = new Scene()
        this.scene.background = new Color(config.backgroundColor)
        this.camera = new PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 100)

        // Add ambient light for general illumination
        const ambientLight = new AmbientLight(0xffffff, 1.5)
        this.scene.add(ambientLight)

        // Cursor point light
        this.cursorLight = new PointLight(0xffffff, 5, 20)

        this.tileWidth = 2.3
        this.tileHeight = 2.3*0.85
        this.renderer = new WebGLRenderer({canvas})
        this.renderer.setSize(canvas.width, canvas.height)

        this.materials = {}
        config.colors.forEach((color, i) => this.addMaterial(i, color))

        const radius = this.tileWidth / 2
        this.hexGeometry = new CylinderGeometry(radius, radius, 0.5, 6)

        this.meshes = {}

        // Create cursor torus
        const torusGeometry = new TorusGeometry(radius + 0.15, 0.1, 16, 32)
        const torusMaterial = new MeshPhongMaterial({
            color: config.cursorColor,
            emissive: config.cursorColor,
            emissiveIntensity: 0.5
        })
        this.cursorTorus = new Mesh(torusGeometry, torusMaterial)
        this.scene.add(this.cursorTorus)

        // Add cursor light and attach it to the torus
        this.scene.add(this.cursorLight)

        // Load font for text rendering
        /*const loader = new FontLoader()
        try{
            loader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
                this.font = font
            }, undefined, (err) => {
                console.warn('Font loading failed, text rendering will be disabled:', err)
            })
        } catch(_) {
            console.warn('Font loading failed')
        }*/
    }
    reset(): void {
        // Clear all hex meshes from the scene
        for (const id in this.meshes) {
            this.scene.remove(this.meshes[id])
        }
        this.meshes = {}
        this.hexPositions.clear()
        this.animatingHexes.clear()
    }

    async animateVanish(uniq: (Hex | undefined)[]): Promise<void> {
        this.timer.hold(this.config.animation.vanishAnimationTime)

        const vanishingHexes = uniq.filter(h => h !== undefined) as Hex[]
        vanishingHexes.forEach(h => this.animatingHexes.add(h.id))

        if (vanishingHexes.length === 0) {
            return
        }

        const duration = this.config.animation.vanishAnimationTime

        // Create scale tween for each vanishing hex
        const tweens = vanishingHexes
            .map(hex => this.meshes[hex.id])
            .filter(mesh => mesh !== undefined)
            .map(mesh => new TWEEN.Tween(mesh.scale)
                .to({ x: 0, y: 0, z: 0 }, duration)
                .easing(TWEEN.Easing.Quadratic.In)
            )

        await tweenPromise(this, duration, tweens)

        // Remove vanished hexes
        for (const hex of vanishingHexes) {
            const mesh = this.meshes[hex.id]
            if (mesh) {
                this.scene.remove(mesh)
                delete this.meshes[hex.id]
            }
            this.hexPositions.delete(hex.id)
            this.animatingHexes.delete(hex.id)
        }
    }

    async animateShowText(calculatedPoints: number, text: string): Promise<void> {
        this.timer.hold(this.config.animation.textAnimationTime)

        if (!this.font) {
            console.warn('Font not loaded, skipping text animation')
            return
        }

        // TODO: Implement gradient color for text - currently using simple fill color
        const textColor = 0xff00ff // Magenta as a placeholder

        const duration = this.config.animation.textAnimationTime
        const startSize = 5 / 20
        const endSize = (5 + calculatedPoints * 5) / 20

        // Create text mesh
        const geometry = new TextGeometry(String(calculatedPoints), {
            font: this.font,
            size: startSize,
            depth: 0.1,
        })
        const material = new MeshPhongMaterial({ color: textColor, emissive: textColor })
        const textMesh = new Mesh(geometry, material)

        const centerPos = this.gridToPosition(3.5, 3.5)
        textMesh.position.set(centerPos.x - 0.5, centerPos.y - 0.3, -9)
        textMesh.rotation.x = Math.PI / 2

        this.scene.add(textMesh)
        this.textMeshes.push(textMesh)

        // Animate scale to simulate size growth
        const scaleRatio = endSize / startSize
        const tween = new TWEEN.Tween(textMesh.scale)
            .to({ x: scaleRatio, y: scaleRatio, z: scaleRatio }, duration)
            .easing(TWEEN.Easing.Quadratic.Out)

        await tweenPromise(this, duration, [tween])

        // Clean up text meshes
        this.textMeshes.forEach(mesh => this.scene.remove(mesh))
        this.textMeshes = []
    }

    async animateRotate(clockwise: boolean, cursor: Coordinate, hexes: (Hex | undefined)[]): Promise<void> {
        this.timer.hold(this.config.animation.rotateAnimationTime)

        const rotatingHexes = hexes.filter(h => h !== undefined) as Hex[]
        rotatingHexes.forEach(h => this.animatingHexes.add(h.id))

        if (rotatingHexes.length === 0) {
            return
        }

        const duration = this.config.animation.rotateAnimationTime
        const cursorPos = this.gridToPosition(cursor.x, cursor.y)
        const cursorVec = new Vector3(cursorPos.x, cursorPos.y, -11)
        const angleStep = (Math.PI * 2) / 6
        const totalRotation = (clockwise ? -1 : 1) * angleStep

        // Create position tween for each rotating hex
        const tweens = rotatingHexes
            .map(hex => this.meshes[hex.id])
            .filter(mesh => mesh !== undefined)
            .map(mesh => {
                const startPos = mesh.position.clone()
                const dx = startPos.x - cursorVec.x
                const dy = startPos.y - cursorVec.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                const startAngle = Math.atan2(dy, dx)
                const endAngle = startAngle + totalRotation
                const endX = cursorVec.x + Math.cos(endAngle) * distance
                const endY = cursorVec.y + Math.sin(endAngle) * distance

                return new TWEEN.Tween(mesh.position)
                    .to({ x: endX, y: endY, z: -11 }, duration)
                    .easing(TWEEN.Easing.Quadratic.InOut)
            })

        await tweenPromise(this, duration, tweens)
        rotatingHexes.forEach(h => this.animatingHexes.delete(h.id))
    }

    async animateShiftLeft(shiftedUniq: (Coordinate & { distance: number; })[]): Promise<void> {
        this.timer.hold(this.config.animation.shiftAnimationTime)

        const duration = this.config.animation.shiftAnimationTime
        const tweens: TWEEN.Tween<any>[] = []

        // Build animation tweens for each shifting hex
        for (const coord of shiftedUniq) {
            for (const [id, pos] of this.hexPositions) {
                if (pos.gridX === coord.x && pos.gridY === coord.y) {
                    const mesh = this.meshes[id]
                    if (mesh) {
                        const endPixel = this.gridToPosition(pos.gridX - coord.distance, pos.gridY)

                        const tween = new TWEEN.Tween(mesh.position)
                            .to({ x: endPixel.x, y: endPixel.y, z: -11 }, duration)
                            .easing(TWEEN.Easing.Quadratic.InOut)
                        tweens.push(tween)
                        this.animatingHexes.add(id)
                    }
                }
            }
        }

        if (tweens.length === 0) {
            return
        }

        await tweenPromise(this, duration, tweens)
        this.animatingHexes.clear()
    }

    private addMaterial(colorIndex: number, color: string) {
        const material = new HexBevelMaterial({
            color: color,
            bevelWidth: 0.15,
            shininess: 100
        })
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
        const centerX = gridX * this.tileWidth + radius * (1 + (gridY + 1) % 2) - 8;
        const centerY = -(gridY * this.tileHeight + radius - 7); // Invert Y for Three.js coordinate system
        return { x: centerX, y: centerY };
    }

    clear(): void {
        // not needed I think
    }
    render(){
        this.renderer.render(this.scene, this.camera)
    }
    setHexPosition(gridX: number, gridY: number, hex: Hex): void {
        this.hexPositions.set(hex.id, { gridX, gridY })
        const mesh = this.getOrCreateMesh(hex)
        const pos = this.gridToPosition(gridX, gridY)
        mesh.position.set(
            pos.x,
            pos.y,
            -11
        )
    }

    setCursorPosition(gridX: number, gridY: number): void {
        const pos = this.gridToPosition(gridX, gridY)
        const targetTorusPos = { x: pos.x, y: pos.y, z: -10.5 }
        const targetLightPos = { x: pos.x, y: pos.y, z: -9 }

        // Remove all existing cursor animations
        this.cursorTweenGroup.removeAll()

        // Animation duration in milliseconds (reasonably quick)
        const duration = 150

        // Create tweens for both torus and light positions
        const torusTween = new TWEEN.Tween(this.cursorTorus.position, this.cursorTweenGroup)
            .to(targetTorusPos, duration)
            .easing(TWEEN.Easing.Quadratic.Out)

        const lightTween = new TWEEN.Tween(this.cursorLight.position, this.cursorTweenGroup)
            .to(targetLightPos, duration)
            .easing(TWEEN.Easing.Quadratic.Out)

        // Start both tweens
        torusTween.start()
        lightTween.start()

        // Drive the animation with requestAnimationFrame
        const start = Date.now()
        const tick = () => {
            this.cursorTweenGroup.update()
            this.render()
            const elapsed = Date.now() - start
            if (elapsed < duration) {
                requestAnimationFrame(tick)
            }
        }
        requestAnimationFrame(tick)
    }

    drawText(text: string, centerGridX: number, centerGridY: number, fontSize: number, fillStyle: string | CanvasGradient): void {
        // Clear previous text meshes
        this.textMeshes.forEach(mesh => this.scene.remove(mesh))
        this.textMeshes = []

        if (!this.font) {
            console.warn('Font not loaded yet, cannot draw text')
            return
        }

        const geometry = new TextGeometry(text, {
            font: this.font,
            size: fontSize / 20,
            depth: 0.1,
        })

        // Use magenta as default color if fillStyle is a gradient (not supported yet)
        const color = typeof fillStyle === 'string' ? fillStyle : 0xff00ff
        const material = new MeshPhongMaterial({ color, emissive: color })
        const mesh = new Mesh(geometry, material)

        const pos = this.gridToPosition(centerGridX, centerGridY)
        mesh.position.set(pos.x - 0.5, pos.y - 0.3, -9)
        mesh.rotation.x = Math.PI / 2

        this.scene.add(mesh)
        this.textMeshes.push(mesh)
    }

    getColorForHex(hexValue: number): string {
        if (hexValue < 0) {
            return "transparent"
        }
        return this.config.colors[hexValue]
    }

}