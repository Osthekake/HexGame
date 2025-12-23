import { Shape, ExtrudeGeometry, BufferGeometry } from 'three'

export interface HexGeometryOptions {
    radius: number
    height: number
    bevelSize?: number
    bevelThickness?: number
    bevelSegments?: number
}

/**
 * Creates a beveled hexagon geometry using ExtrudeGeometry.
 * The bevel provides real 3D geometry while the shader handles smooth normal calculations.
 */
export function createBeveledHexGeometry(options: HexGeometryOptions): BufferGeometry {
    const {
        radius,
        height,
        bevelSize = 0.15,
        bevelThickness = 0.1,
        bevelSegments = 3
    } = options

    // Create hexagon shape in XY plane
    const hexShape = new Shape()
    const angleStep = Math.PI / 3 // 60 degrees
    const angleOffset = Math.PI / 6 // 30 degrees - makes corners point up/down

    // Start at the first vertex (30 degrees)
    hexShape.moveTo(
        Math.cos(angleOffset) * radius,
        Math.sin(angleOffset) * radius
    )

    // Draw hexagon vertices
    for (let i = 1; i <= 6; i++) {
        const angle = i * angleStep + angleOffset
        hexShape.lineTo(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius
        )
    }

    // Extrude the hexagon with bevel
    const geometry = new ExtrudeGeometry(hexShape, {
        depth: height,
        bevelEnabled: true,
        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelSegments: bevelSegments,
        curveSegments: 1 // Keep straight edges for hexagon
    })

    // Rotate geometry to align with CylinderGeometry orientation
    // ExtrudeGeometry extrudes along Z, but CylinderGeometry has Y as the height axis
    //geometry.rotateZ(Math.PI / 2)

    // Center the geometry vertically (ExtrudeGeometry starts at 0)
    geometry.translate(0, 0, 0)

    return geometry
}
