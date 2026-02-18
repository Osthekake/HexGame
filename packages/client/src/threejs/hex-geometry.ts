import { Shape, ExtrudeGeometry, BufferGeometry } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface HexGeometryOptions {
    radius: number
    height: number
    bevelSize?: number
    bevelThickness?: number
    bevelSegments?: number
    cornerRadius?: number
}

/**
 * Creates a beveled hexagon geometry using ExtrudeGeometry.
 * The bevel provides real 3D geometry while the shader handles smooth normal calculations.
 */
export function createBeveledHexGeometry(options: HexGeometryOptions): BufferGeometry {
    const {
        radius,
        height,
        bevelSize = 0.5,
        bevelThickness = 0.25,
        bevelSegments = 6,
        cornerRadius = 0.05
    } = options

    // Create hexagon shape with rounded corners
    // Use a simpler approach: just use quadraticCurveTo with a carefully positioned control point
    const hexShape = new Shape()
    const angleStep = Math.PI / 3 // 60 degrees
    const angleOffset = Math.PI / 6 // 30 degrees - makes corners point up/down

    // Start by calculating all corner positions and edge start/end points
    const corners: Array<{x: number, y: number}> = []
    const edgeEnds: Array<{x: number, y: number}> = []
    const edgeStarts: Array<{x: number, y: number}> = []

    for (let i = 0; i < 6; i++) {
        const cornerAngle = i * angleStep + angleOffset
        const nextCornerAngle = ((i + 1) % 6) * angleStep + angleOffset

        const cornerX = Math.cos(cornerAngle) * radius
        const cornerY = Math.sin(cornerAngle) * radius
        const nextCornerX = Math.cos(nextCornerAngle) * radius
        const nextCornerY = Math.sin(nextCornerAngle) * radius

        corners.push({x: cornerX, y: cornerY})

        // Calculate edge direction from this corner to next
        const edgeDirX = nextCornerX - cornerX
        const edgeDirY = nextCornerY - cornerY
        const edgeLength = Math.sqrt(edgeDirX * edgeDirX + edgeDirY * edgeDirY)

        // Point where straight edge starts (inset from current corner)
        const startX = cornerX + (edgeDirX / edgeLength) * cornerRadius
        const startY = cornerY + (edgeDirY / edgeLength) * cornerRadius
        edgeStarts.push({x: startX, y: startY})

        // Point where straight edge ends (inset from next corner)
        const endX = nextCornerX - (edgeDirX / edgeLength) * cornerRadius
        const endY = nextCornerY - (edgeDirY / edgeLength) * cornerRadius
        edgeEnds.push({x: endX, y: endY})
    }

    // Now draw the path
    hexShape.moveTo(edgeStarts[0].x, edgeStarts[0].y)

    for (let i = 0; i < 6; i++) {
        const nextI = (i + 1) % 6

        // Draw straight edge
        hexShape.lineTo(edgeEnds[i].x, edgeEnds[i].y)

        // Draw rounded corner using bezier curve with control points
        // positioned to maintain straight tangents at start and end
        const cp1 = {
            x: edgeEnds[i].x + (corners[nextI].x - edgeEnds[i].x) * 0.5,
            y: edgeEnds[i].y + (corners[nextI].y - edgeEnds[i].y) * 0.5
        }
        const cp2 = {
            x: edgeStarts[nextI].x + (corners[nextI].x - edgeStarts[nextI].x) * 0.5,
            y: edgeStarts[nextI].y + (corners[nextI].y - edgeStarts[nextI].y) * 0.5
        }

        hexShape.bezierCurveTo(
            cp1.x, cp1.y,  // First control point
            cp2.x, cp2.y,  // Second control point
            edgeStarts[nextI].x, edgeStarts[nextI].y  // End point
        )
    }

    // Extrude the hexagon with bevel
    const extrudedGeometry = new ExtrudeGeometry(hexShape, {
        depth: height,
        bevelEnabled: true,
        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelSegments: bevelSegments,
        curveSegments: 2 // Keep straight edges for hexagon
    })

    // Delete existing normals that ExtrudeGeometry created
    // We want to compute fresh smooth normals after merging
    extrudedGeometry.deleteAttribute('normal')

    // Merge vertices at the same position so they can share normals
    // This is necessary because ExtrudeGeometry creates duplicate vertices for each face
    const geometry = mergeVertices(extrudedGeometry, 0.0001)
    
    // NOW compute smooth vertex normals on the merged geometry
    // This will average face normals for all faces sharing each vertex
    geometry.computeVertexNormals()

    // Center the geometry vertically (ExtrudeGeometry starts at 0)
    geometry.translate(0, 0, 0)

    return geometry
}
