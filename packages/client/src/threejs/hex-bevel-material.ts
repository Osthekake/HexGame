import { ShaderMaterial, Color, UniformsUtils, UniformsLib } from 'three'

export interface HexBevelMaterialOptions {
    color: string
    shininess?: number
}

export class HexBevelMaterial extends ShaderMaterial {
    constructor(options: HexBevelMaterialOptions) {
        const color = new Color(options.color)
        const shininess = options.shininess ?? 100

        super({
            uniforms: UniformsUtils.merge([
                UniformsLib.lights,
                {
                    baseColor: { value: color },
                    shininess: { value: shininess }
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
                uniform float shininess;

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

                void main() {
                    // Use the smooth vertex normals computed by Three.js
                    vec3 normal = normalize(vNormal);

                    // DEBUG: Visualize normals as colors
                    // gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
                    // return;

                    // Lighting calculations
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
                            float diff = max(dot(normal, lightDir), 0.0);
                            vec3 diffuse = diff * baseColor * pointLights[i].color * attenuation;

                            // Specular (Phong)
                            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                            vec3 reflectDir = reflect(-lightDir, normal);
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

    setShininess(shininess: number) {
        this.uniforms.shininess.value = shininess
    }
}
