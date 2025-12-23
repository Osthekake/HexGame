import { ShaderMaterial, Color, UniformsUtils, UniformsLib } from 'three'

export interface HexBevelMaterialOptions {
    color: string
    bevelWidth?: number
    shininess?: number
    hexRadius?: number
}

export class HexBevelMaterial extends ShaderMaterial {
    constructor(options: HexBevelMaterialOptions) {
        const color = new Color(options.color)
        const bevelWidth = options.bevelWidth ?? 0.15
        const shininess = options.shininess ?? 100
        const hexRadius = options.hexRadius ?? 1.15

        super({
            uniforms: UniformsUtils.merge([
                UniformsLib.lights,
                {
                    baseColor: { value: color },
                    bevelWidth: { value: bevelWidth },
                    shininess: { value: shininess },
                    hexRadius: { value: hexRadius }
                }
            ]),
            vertexShader: `
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 baseColor;
                uniform float bevelWidth;
                uniform float shininess;
                uniform float hexRadius;

                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                // Three.js light uniforms (injected automatically with lights: true)
                struct PointLight {
                    vec3 position;
                    vec3 color;
                    float distance;
                    float decay;
                };
                uniform PointLight pointLights[NUM_POINT_LIGHTS];
                uniform vec3 ambientLightColor;

                // Calculate distance from point to a line segment
                float distanceToEdge(vec2 p, vec2 a, vec2 b) {
                    vec2 pa = p - a;
                    vec2 ba = b - a;
                    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                    return length(pa - ba * h);
                }

                void main() {
                    // Define the 6 vertices of a regular hexagon in local space
                    float angle = 3.14159265359 / 3.0; // 60 degrees

                    vec2 hexVerts[6];
                    for (int i = 0; i < 6; i++) {
                        // Add PI/6 (30 degrees) to match the geometry's orientation
                        // This makes corners point up/down (y-axis) and flats face left/right (x-axis)
                        float a = float(i) * angle + 3.14159265359 / 6.0;
                        hexVerts[i] = vec2(cos(a), sin(a)) * hexRadius;
                    }

                    // Smooth the normal based on distance to edge
                    // The ExtrudeGeometry provides the actual bevel shape,
                    // but we smooth the normals further for perfect lighting
                    vec3 smoothedNormal = vNormal;

                    // Only apply smoothing to top surface and bevels
                    // Check if this is a top-facing surface (normal pointing up in Z)
                    // Side walls have normals pointing horizontally (normal.z near 0)
                    if (abs(vNormal.z) > 0.3) {
                        // Current position in XY plane (top face)
                        vec2 pos2D = vPosition.xy;

                        // Find minimum distance to any edge and the perpendicular direction
                        float minDist = 1000.0;
                        vec2 nearestEdgeDir = vec2(0.0);

                        for (int i = 0; i < 6; i++) {
                            int nextI = (i + 1) % 6;
                            vec2 edgeStart = hexVerts[i];
                            vec2 edgeEnd = hexVerts[nextI];

                            float dist = distanceToEdge(pos2D, edgeStart, edgeEnd);

                            if (dist < minDist) {
                                minDist = dist;
                                // Calculate perpendicular direction pointing outward from edge
                                vec2 edgeVec = normalize(edgeEnd - edgeStart);
                                nearestEdgeDir = vec2(-edgeVec.y, edgeVec.x);
                                // Make sure it points outward (away from center)
                                if (dot(nearestEdgeDir, pos2D) < 0.0) {
                                    nearestEdgeDir = -nearestEdgeDir;
                                }
                            }
                        }

                        // Only smooth normals in the bevel region
                        if (minDist < bevelWidth) {
                            // Calculate how far into the bevel we are (0 = center, 1 = edge)
                            float bevelFactor = smoothstep(bevelWidth, 0.0, minDist);

                            // Create a smooth outward-facing normal for the bevel
                            // Blend between flat (0,0,1) and angled outward
                            vec3 idealBevelNormal = normalize(vec3(
                                nearestEdgeDir.x * bevelFactor,
                                nearestEdgeDir.y * bevelFactor,
                                1.0
                            ));

                            // Blend between the geometry's normal and our smoothed normal
                            // This removes faceting from the ExtrudeGeometry's bevel segments
                            smoothedNormal = normalize(mix(vNormal, idealBevelNormal, 0.6));
                        }
                    }

                    // Lighting calculations with smoothed normals
                    vec3 finalColor = baseColor * ambientLightColor * 0.5;

                    // Add point lights
                    #if NUM_POINT_LIGHTS > 0
                        for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
                            vec3 lightDir = normalize(pointLights[i].position - vWorldPosition);
                            float lightDistance = length(pointLights[i].position - vWorldPosition);

                            // Attenuation based on Three.js point light model
                            float decay = pointLights[i].decay;
                            float maxDistance = pointLights[i].distance;
                            float attenuation = pow(clamp(1.0 - lightDistance / maxDistance, 0.0, 1.0), decay);

                            // Diffuse
                            float diff = max(dot(smoothedNormal, lightDir), 0.0);
                            vec3 diffuse = diff * baseColor * pointLights[i].color * attenuation;

                            // Specular (Phong)
                            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                            vec3 reflectDir = reflect(-lightDir, smoothedNormal);
                            float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
                            vec3 specular = spec * pointLights[i].color * attenuation;

                            finalColor += diffuse + specular * 0.3;
                        }
                    #endif

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            lights: true // Enable Three.js light uniforms
        })
    }

    setColor(color: string) {
        this.uniforms.baseColor.value = new Color(color)
    }

    setBevelWidth(width: number) {
        this.uniforms.bevelWidth.value = width
    }

    setShininess(shininess: number) {
        this.uniforms.shininess.value = shininess
    }
}
