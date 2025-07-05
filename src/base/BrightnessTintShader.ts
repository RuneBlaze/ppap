import Phaser from "phaser";
import { OKLAB_GLSL_SNIPPET } from "./ShaderUtils";

export class BrightnessTintShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _tintIntensity: number = 0.0;
  private _tintColor: [number, number, number] = [1.0, 1.0, 1.0];

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'BrightnessTint',
      renderTarget: true,
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float tintIntensity;
        uniform vec3 tintColor;
        varying vec2 outTexCoord;
        
        ${OKLAB_GLSL_SNIPPET}
        
        void main() {
          vec4 originalColor = texture2D(uMainSampler, outTexCoord);
          
          // Early-out for transparent texels so that the effect only
          // touches the sprite itself (fixes full-screen flash).
          if (originalColor.a < 0.05) {
            gl_FragColor = originalColor;
            return;
          }
          
          // Convert to OKLab for perceptual mixing
          vec3 labOrig = rgbToOklab(originalColor.rgb);
          vec3 labTint = rgbToOklab(tintColor);
          
          vec3 mixedLab = mix(labOrig, labTint, tintIntensity);
          vec3 mixedRgb = oklabToRgb(mixedLab);
          
          gl_FragColor = vec4(mixedRgb, originalColor.a);
        }
      `
    });
  }

  onPreRender(): void {
    this.set1f('tintIntensity', this._tintIntensity);
    this.set3f('tintColor', this._tintColor[0], this._tintColor[1], this._tintColor[2]);
  }

  get tintIntensity(): number {
    return this._tintIntensity;
  }

  set tintIntensity(value: number) {
    this._tintIntensity = Math.max(0, Math.min(1, value));
  }

  get tintColor(): [number, number, number] {
    return this._tintColor;
  }

  set tintColor(value: [number, number, number]) {
    this._tintColor = value;
  }

  static registerShader(game: Phaser.Game): void {
    const renderer = game.renderer;
    
    if (renderer.type === Phaser.WEBGL) {
      const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      webglRenderer.pipelines.addPostPipeline('BrightnessTint', BrightnessTintShader);
    }
  }
}