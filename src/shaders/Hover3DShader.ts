import Phaser from "phaser";

/**
 * Unique key to register / retrieve the shader from the WebGL pipeline manager.
 */
export const SHADER_KEY = "Hover3D" as const;

/**
 * Generic 3-D hover / flip Post-FX shader originally implemented for CardSprite.
 *
 * The shader simulates a subtle perspective warping, rim lighting, chromatic
 * aberration and an optional flip "glint".  It is designed to be lightweight
 * and fully self-contained so that any GameObject can enable it just by calling
 * `gameObject.setPipeline(SHADER_KEY)` after registering the pipeline.
 *
 * The effect is tuned for pixel-art sprites but works for any texture.  Because
 * the shader relies on per-object uniforms (e.g. mouse position), each
 * GameObject should maintain its own reference and update the uniforms every
 * frame via the standard `set1f/2f` helpers.
 */
export class Hover3DShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      // We need a render target so individual GameObjects can own a copy of
      // the pipeline and manipulate its uniforms independently.
      renderTarget: true,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float hovering;
uniform vec2 mouseScreenPos;
uniform float time;
uniform vec2 cardSize;      // generic object size – name kept for retro-compat
uniform float flipProgress; // 0-1, allow external flip animation if desired

varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;
    vec4 color = texture2D(uMainSampler, uv);

    // ---------------- Flip animation -------------------
    if (flipProgress > 0.0) {
        vec2 center = vec2(0.5, 0.5);
        vec2 fromCenter = uv - center;

        // Perspective skew while flipping
        float perspective = fromCenter.y * fromCenter.y * flipProgress * 0.5;
        fromCenter.x -= perspective;
        vec2 warpedUV = center + fromCenter;

        if (all(greaterThanEqual(warpedUV, vec2(0.0))) && all(lessThanEqual(warpedUV, vec2(1.0)))) {
            color = texture2D(uMainSampler, warpedUV);
        }

        // Metallic edge glint
        float glint = pow(flipProgress, 10.0);
        color.rgb += vec3(1.0, 1.0, 0.9) * glint * 0.5;
        // Slight darkening as the sprite tilts away
        color.rgb *= (1.0 - flipProgress * 0.3);
    }

    // ---------------- Hovering effect ------------------
    if (hovering > 0.5) {
        vec2 center = vec2(0.5, 0.5);
        vec2 fromCenter = uv - center;

        // Normalised mouse position drives perspective tilt
        vec2 mouseNorm = mouseScreenPos / 2000.0;

        // Depth oscillation – gives a subtle breathing motion
        float depth = 0.1 * sin(time * 2.0 + length(fromCenter) * 10.0);
        vec2 perspective = fromCenter * (1.0 + depth + mouseNorm.x * 0.1);
        vec2 distortedUV = center + perspective;

        if (all(greaterThanEqual(distortedUV, vec2(0.0))) && all(lessThanEqual(distortedUV, vec2(1.0)))) {
            color = texture2D(uMainSampler, distortedUV);
        }

        // Highlight towards the mouse cursor
        float highlight = 1.0 - length(fromCenter - mouseNorm * 0.2);
        highlight = pow(max(0.0, highlight), 3.0);
        color.rgb += vec3(highlight * 0.3, highlight * 0.2, highlight * 0.1);

        // Rim lighting around the perimeter
        float rim = 1.0 - dot(normalize(fromCenter), vec2(0.0, 1.0));
        rim = pow(rim, 2.0);
        color.rgb += vec3(rim * 0.2, rim * 0.3, rim * 0.4) * hovering;

        // Simple chromatic aberration towards edges
        float aberration = length(fromCenter) * 0.01;
        color.r = texture2D(uMainSampler, distortedUV + vec2(aberration, 0.0)).r;
        color.b = texture2D(uMainSampler, distortedUV - vec2(aberration, 0.0)).b;
    }

    gl_FragColor = color;
}`,
    });
  }
} 