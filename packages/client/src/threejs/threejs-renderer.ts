import { GameConfig } from "../config";
import { Coordinate, Hex } from "../grid";
import { HexRenderer } from "../renderer";
import { GameTimer } from "../timer";
import {
    Camera, Color, Material, Mesh, MeshPhongMaterial,
    PerspectiveCamera, PointLight, Scene, WebGLRenderer, TorusGeometry,
    AmbientLight, DirectionalLight, Vector3, BufferGeometry, Raycaster, Vector2, Plane,
    CanvasTexture, SpriteMaterial, Sprite
} from 'three'
import * as TWEEN from '@tweenjs/tween.js'
import { Group } from '@tweenjs/tween.js'
import { tweenPromise } from './tween-promise'
import { HexBevelMaterial } from './hex-bevel-material'
import { createBeveledHexGeometry } from './hex-geometry'

export class ThreeJsRenderer implements HexRenderer {
    scene: Scene
    camera: Camera
    renderer: WebGLRenderer
    cursorLight: PointLight
    cursorTorus: Mesh

    tileWidth: number
    tileHeight: number

    materials: Record<number, Material>
    hexGeometry: BufferGeometry
    hexRadius: number

    meshes: Record<number, Mesh>
    hexPositions: Map<number, { gridX: number; gridY: number;}> = new Map()

    private config: GameConfig
    private timer: GameTimer
    private textSprites: Sprite[] = []
    private animatingHexes: Set<number> = new Set()
    private cursorTweenGroup: Group = new Group()

    constructor(canvas: HTMLCanvasElement, config: GameConfig, timer: GameTimer){
        this.config = config
        this.timer = timer
        this.scene = new Scene()
        this.scene.background = new Color(config.backgroundColor)
        this.camera = new PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 100)

        // Add ambient light for general illumination
        const ambientLight = new AmbientLight(0xffffff, 0.3)
        this.scene.add(ambientLight)

        // Add directional light to make shading more visible
        const directionalLight = new DirectionalLight(0xffffff, 2)
        directionalLight.position.set(5, 5, 10)
        this.scene.add(directionalLight)

        // Cursor point light
        this.cursorLight = new PointLight(0xffffff, 50, 20)

        this.tileWidth = 2.3
        this.tileHeight = 2.3*0.85
        this.renderer = new WebGLRenderer({canvas})
        this.renderer.setSize(canvas.width, canvas.height)

        const radius = this.tileWidth / 2
        // Make hex slightly smaller than tile size to create gaps between hexes
        this.hexRadius = radius * 0.8

        this.materials = {}
        config.colors.forEach((color, i) => this.addMaterial(i, color))

        this.hexGeometry = createBeveledHexGeometry({
            radius: this.hexRadius,
            height: 0.5,
            bevelSize: 0.25,
            bevelThickness: 0.2,
            bevelSegments: 3,
            cornerRadius: 0.08  // Small rounded corners
        })

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

        const duration = this.config.animation.textAnimationTime
        const startSize = 5
        const endSize = 5 + calculatedPoints * 5

        // Create off-screen canvas for text (transparent background by default)
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')!

        // Create sprite with canvas texture
        const texture = new CanvasTexture(canvas)
        const material = new SpriteMaterial({ map: texture, transparent: true })
        const sprite = new Sprite(material)

        const centerPos = this.gridToPosition(3.5, 3.5)
        sprite.position.set(centerPos.x, centerPos.y, -9)

        this.scene.add(sprite)
        this.textSprites.push(sprite)

        // Animate using requestAnimationFrame (matching Canvas2D approach)
        const startTime = Date.now()

        await new Promise<void>((resolve) => {
            const tick = () => {
                const elapsed = Date.now() - startTime
                const fraction = Math.min(elapsed / duration, 1)

                // Calculate current font size
                const fontSize = Math.round(startSize + fraction * calculatedPoints * 5)

                // Clear and redraw text
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.font = `${fontSize * 2}px Verdana`
                ctx.fillStyle = 'magenta'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(String(calculatedPoints), canvas.width / 2, canvas.height / 2)

                // Update texture
                texture.needsUpdate = true

                // Scale sprite based on font size
                const scale = fontSize / 20
                sprite.scale.set(scale * 2, scale * 2, 1)

                this.render()

                if (elapsed < duration) {
                    requestAnimationFrame(tick)
                } else {
                    resolve()
                }
            }
            requestAnimationFrame(tick)
        })

        // Clean up
        this.scene.remove(sprite)
        this.textSprites = this.textSprites.filter(s => s !== sprite)
        material.dispose()
        texture.dispose()
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

        // Create position and self-rotation tweens for each rotating hex
        const tweens = rotatingHexes
            .map(hex => this.meshes[hex.id])
            .filter(mesh => mesh !== undefined)
            .flatMap(mesh => {
                const startPos = mesh.position.clone()
                const dx = startPos.x - cursorVec.x
                const dy = startPos.y - cursorVec.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                const startAngle = Math.atan2(dy, dx)
                const endAngle = startAngle + totalRotation
                const endX = cursorVec.x + Math.cos(endAngle) * distance
                const endY = cursorVec.y + Math.sin(endAngle) * distance

                const positionTween = new TWEEN.Tween(mesh.position)
                    .to({ x: endX, y: endY, z: -11 }, duration)
                    .easing(TWEEN.Easing.Quadratic.InOut)

                const rotationTween = new TWEEN.Tween(mesh.rotation)
                    .to({ z: mesh.rotation.z + totalRotation }, duration)
                    .easing(TWEEN.Easing.Quadratic.InOut)

                return [positionTween, rotationTween]
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
        // Using built-in MeshPhongMaterial to test smooth normals
        const material = new MeshPhongMaterial({
            color: color,
            shininess: 500,
            
            flatShading: false
        })
        this.materials[colorIndex] = material
    }

    private addMesh(hex: Hex) {
        const material = this.materials[hex.colorIndex]
        const mesh = new Mesh(this.hexGeometry, material)
        // No rotation needed - ExtrudeGeometry is already oriented correctly
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
        const targetTorusPos = { x: pos.x, y: pos.y, z: -10.2 }
        const targetLightPos = { x: pos.x, y: pos.y, z: -7 }

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

    getColorForHex(hexValue: number): string {
        if (hexValue < 0) {
            return "transparent"
        }
        return this.config.colors[hexValue]
    }

    pixelToGrid(pixelX: number, pixelY: number): { gridX: number; gridY: number } | null {
        // pixelX/pixelY are already relative to canvas (rect.left/top already subtracted in input handler)
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        // Convert to normalized device coordinates [-1, 1]
        // Note: pixelX/pixelY are already canvas-relative, so don't subtract rect.left/top again
        const ndcX = (pixelX / rect.width) * 2 - 1;
        const ndcY = -(pixelY / rect.height) * 2 + 1;

        // Create raycaster from camera through click point
        const raycaster = new Raycaster();
        raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.camera);

        // Intersect with plane at Z = -11 (where hexes are)
        const hexPlane = new Plane(new Vector3(0, 0, 1), 11);
        const intersection = new Vector3();
        const didIntersect = raycaster.ray.intersectPlane(hexPlane, intersection);

        if (!didIntersect || !intersection) {
            // Ray didn't hit the plane - fallback to center
            return this.findClosestViableHex(3, 3);
        }

        // World coordinates at hex plane
        const worldX = intersection.x;
        const worldY = intersection.y;

        // Invert gridToPosition formulas (same approach as Canvas2D)
        const radius = this.tileWidth / 2;

        // Step 1: Invert Y formula: centerY = -(gridY * tileHeight + radius - 7)
        const roughGridY = Math.round((7 - radius - worldY) / this.tileHeight);

        // Step 2: Determine row offset for this Y position
        const rowOffset = radius * (1 + (roughGridY + 1) % 2);

        // Step 3: Invert X formula: centerX = gridX * tileWidth + rowOffset - 8
        const roughGridX = Math.round((worldX + 8 - rowOffset) / this.tileWidth);

        // Step 4: Find closest viable hex
        return this.findClosestViableHex(roughGridX, roughGridY);
    }

    private findClosestViableHex(roughGridX: number, roughGridY: number): { gridX: number; gridY: number } | null {
        // Clamp to grid bounds
        const clampedX = Math.max(0, Math.min(6, roughGridX));
        const clampedY = Math.max(0, Math.min(6, roughGridY));

        // Search 3x3 area for closest viable hex
        let closestX = clampedX;
        let closestY = clampedY;
        let closestDist = Infinity;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const testX = clampedX + dx;
                const testY = clampedY + dy;

                // Skip if outside grid
                if (testX < 0 || testX > 6 || testY < 0 || testY > 6) continue;

                // Skip if not viable (must be [1,5])
                if (testX < 1 || testX > 5 || testY < 1 || testY > 5) continue;

                // Calculate Manhattan distance from rough position
                const dist = Math.abs(testX - roughGridX) + Math.abs(testY - roughGridY);

                if (dist < closestDist) {
                    closestDist = dist;
                    closestX = testX;
                    closestY = testY;
                }
            }
        }

        return { gridX: closestX, gridY: closestY };
    }

    updateCameraAspect(width: number, height: number): void {
        const camera = this.camera as PerspectiveCamera;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

}