import { Palette } from './palette';
import { type FontKey, getFontStyle, fonts } from './fonts';
import { ColorUtils } from './color-utils';

import iconUrl from './assets/icons_full_16.png?url'; // 16 x 16 sprite sheet of icons. Each row has 16 icons.

export interface WindowSkinOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  borderColor?: string;
  fillColor?: string;
  cornerRadius?: number;
}

export interface GaugeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  maxValue: number;
  borderColor?: string;
  backgroundFillColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
  fontKey?: FontKey;
  showValue?: boolean;
  showMaxValue?: boolean;
  quantize?: boolean;
}

export interface DitherOptions {
  intensity?: number;
  paletteColors?: string[];
}

// Stylized dithering shader with GPU-friendly approximation
class StylizedDitherShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _intensity: number = 1.0;
  private _resolution: { width: number; height: number } = { width: 800, height: 600 };

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'StylizedDither',
      renderTarget: true,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float     intensity;        // 0 → off, 1 → full dither
uniform vec2      resolution;       // framebuffer size in pixels
uniform vec3      paletteColors[32];

varying vec2 outTexCoord;

/* -------- nearest-colour quantiser -------------------------------------- */
vec3 quantizeToNearestPalette(vec3 c)
{
    float bestDist = 999.0;
    vec3  bestCol  = paletteColors[0];

    // fixed-length loop so the compiler can unroll
    for (int i = 0; i < 32; ++i)
    {
        vec3 p = paletteColors[i];
        float d = length(c - p);      // Euclidean distance in RGB
        if (d < bestDist) { bestDist = d; bestCol = p; }
    }
    return bestCol;
}

/* -------- 4×4 Bayer threshold, arithmetic version (0-0.9375) ------------ */
/* Formula: threshold = (4*x + 5*y) mod 16  / 16
   This produces the classic 4×4 Bayer pattern reordered, but any
   permutation of 0-15 works equally well for ordered dithering.           */
float bayer4(vec2 pixPos)
{
    vec2 p = mod(pixPos, 4.0);              // pixel inside the 4×4 tile
    float v = mod(4.0 * p.x + 5.0 * p.y, 16.0);
    return v / 16.0;                        // 0 … 0.9375
}

void main()
{
    vec2 pixPos = outTexCoord * resolution;
    vec4 src    = texture2D(uMainSampler, outTexCoord);

    if (src.a < 0.1) {                      // keep near-transparent texels
        gl_FragColor = src;
        return;
    }

    /* --- ordered-dither bias --------------------------------------------- */
    float t = bayer4(pixPos);               // 0-1 threshold
    const float scale = 1.0 / 255.0;        // ±1 step in 8-bit space
    vec3  nudged = src.rgb + (t - 0.5) * (2.0 * scale * intensity);

    /* --- quantise & blend ------------------------------------------------- */
    vec3 quantised = quantizeToNearestPalette(clamp(nudged, 0.0, 1.0));
    gl_FragColor   = vec4(mix(src.rgb, quantised, intensity), src.a);
}
`
    });
  }

  onPreRender(): void {
    this.set1f('intensity', this._intensity);
    this.set2f('resolution', this._resolution.width, this._resolution.height);
    
    // Set palette colors
    const paletteColors = DrawUtils.getPaletteColorsForShader();
    this.set3fv('paletteColors', new Float32Array(paletteColors));
  }

  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    this._intensity = value;
  }

  get resolution(): { width: number; height: number } {
    return this._resolution;
  }

  set resolution(value: { width: number; height: number }) {
    this._resolution = value;
  }
}


export class DrawUtils {
  static readonly ICONS_KEY = 'icons';
  static readonly ICON_SIZE = 16;

  // Draw retro JRPG windowskin with rounded corners
  static drawWindowSkin(
    graphics: Phaser.GameObjects.Graphics,
    options: WindowSkinOptions
  ): void {
    const {
      x,
      y,
      width,
      height,
      borderColor = Palette.WHITE,
      fillColor = Palette.DARK_PURPLE,
      cornerRadius = 2
    } = options;

    graphics.clear();
    
    // Fill background
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(fillColor).color);
    graphics.fillRoundedRect(x, y, width, height, cornerRadius);

    // Draw border - single pixel width
    graphics.lineStyle(1, Phaser.Display.Color.HexStringToColor(borderColor).color);
    graphics.strokeRoundedRect(x, y, width, height, cornerRadius);
  }

  // Create gradient colors with optional quantization
  static createGradientColors(
    startColor: string,
    endColor: string,
    steps: number,
    quantize: boolean = true
  ): string[] {
    const colors: string[] = [];
    
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const interpolated = ColorUtils.interpolateOklab(startColor, endColor, t);
      const finalColor = quantize ? ColorUtils.quantizeToPalette(interpolated) : 
        `#${interpolated.r.toString(16).padStart(2, '0')}${interpolated.g.toString(16).padStart(2, '0')}${interpolated.b.toString(16).padStart(2, '0')}`;
      colors.push(finalColor);
    }
    
    return colors;
  }

  // Draw gauge with gradient and numbers
  static drawGauge(
    scene: Phaser.Scene,
    graphics: Phaser.GameObjects.Graphics,
    options: GaugeOptions
  ): Phaser.GameObjects.Text | null {
    const {
      x,
      y,
      width,
      height,
      value,
      maxValue,
      borderColor = Palette.WHITE,
      backgroundFillColor = Palette.DARK_PURPLE,
      gradientStart = Palette.RED,
      gradientEnd = Palette.GREEN,
      fontKey = 'retro',
      showValue = true,
      showMaxValue = false,
      quantize = true
    } = options;

    const fillPercentage = Math.max(0, Math.min(1, value / maxValue));
    const fillWidth = Math.floor((width - 2) * fillPercentage);

    graphics.clear();

    // Background fill
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(backgroundFillColor).color);
    graphics.fillRect(x, y, width, height);

    // Create gradient for gauge fill
    if (fillWidth > 0) {
      const gradientSteps = Math.max(1, fillWidth);
      const gradientColors = this.createGradientColors(gradientStart, gradientEnd, gradientSteps, quantize);
      
      // Draw gradient fill pixel by pixel for retro look
      for (let i = 0; i < fillWidth; i++) {
        const colorIndex = Math.floor((i / fillWidth) * (gradientColors.length - 1));
        const color = gradientColors[colorIndex];
        graphics.fillStyle(Phaser.Display.Color.HexStringToColor(color).color);
        graphics.fillRect(x + 1 + i, y + 1, 1, height - 2);
      }
    }

    // Border
    graphics.lineStyle(1, Phaser.Display.Color.HexStringToColor(borderColor).color);
    graphics.strokeRect(x, y, width, height);

    // Add text if requested
    if (showValue || showMaxValue) {
      const textContent = showMaxValue ? `${value}/${maxValue}` : `${value}`;
      const textStyle = getFontStyle(fontKey);
      const fontConfig = fonts[fontKey];
      
      const text = scene.add.text(
        x + width + 4,
        y + (height - fontConfig.size) / 2,
        textContent,
        textStyle
      );
      
      return text;
    }

    return null;
  }

  /**
   * Draws an icon from the icon sheet at the specified position.
   * Assumes `preloadAssets` has been called.
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position  
   * @param iconIndex - Index of the icon in the spritesheet
   * @returns A new `Phaser.GameObjects.Image` instance for the icon.
   */
  static drawIcon(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    iconIndex: number
  ): Phaser.GameObjects.Image {
    const icon = scene.add.image(x, y, this.ICONS_KEY, iconIndex);
    return icon;
  }

  // Helper to create windowskin as a reusable texture
  static createWindowSkinTexture(
    scene: Phaser.Scene,
    key: string,
    options: WindowSkinOptions
  ): void {
    const { width, height } = options;
    const rt = scene.add.renderTexture(0, 0, width, height);
    const graphics = scene.add.graphics();
    
    this.drawWindowSkin(graphics, { ...options, x: 0, y: 0 });
    rt.draw(graphics);
    rt.saveTexture(key);
    
    graphics.destroy();
    rt.destroy();
  }

  // Convert hex color to normalized RGB values for shaders
  static hexToVec3(hex: string): [number, number, number] {
    // Remove the # if present
    const cleanHex = hex.replace('#', '');
    
    // Parse RGB components
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    
    return [r, g, b];
  }

  // Get all palette colors as vec3 array for shader uniforms
  static getPaletteColorsForShader(): number[] {
    const paletteVec3: number[] = [];
    const paletteColors = [
      Palette.BLACK, Palette.DARK_PURPLE, Palette.DARK_BURGUNDY, Palette.BROWN,
      Palette.RUST, Palette.ORANGE, Palette.SAND, Palette.BEIGE,
      Palette.YELLOW, Palette.LIME, Palette.GREEN, Palette.DARK_GREEN,
      Palette.OLIVE, Palette.DARK_OLIVE, Palette.DARK_TEAL, Palette.INDIGO,
      Palette.BLUE, Palette.BRIGHT_BLUE, Palette.SKY_BLUE, Palette.CYAN,
      Palette.LIGHT_BLUE, Palette.WHITE, Palette.GRAY, Palette.DARK_GRAY,
      Palette.CHARCOAL, Palette.DARK_CHARCOAL, Palette.PURPLE, Palette.RED,
      Palette.PINK, Palette.MAGENTA, Palette.YELLOW_GREEN, Palette.GOLD
    ];

    paletteColors.forEach(hex => {
      const [r, g, b] = this.hexToVec3(hex);
      paletteVec3.push(r, g, b);
    });

    return paletteVec3;
  }

  /**
   * Preloads assets required by DrawUtils, such as the icon sheet.
   * Call this in your scene's `preload()` method.
   */
  static preloadAssets(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.ICONS_KEY)) {
      scene.load.spritesheet(this.ICONS_KEY, iconUrl, {
        frameWidth: this.ICON_SIZE,
        frameHeight: this.ICON_SIZE
      });
    }
  }

  // Register stylized dithering shader with the renderer
  static registerStylizedDitherShader(game: Phaser.Game): void {
    const renderer = game.renderer;
    
    if (renderer.type === Phaser.WEBGL) {
      const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      
      try {
        // Register shader using the pipeline manager's class registration method
        webglRenderer.pipelines.addPostPipeline('StylizedDither', StylizedDitherShader);
        
        console.log('Stylized dithering shader registered successfully');
      } catch (error) {
        console.error('Failed to register stylized dithering shader:', error);
      }
    } else {
      console.warn('WebGL renderer not available for stylized dithering shader');
    }
  }

  // Apply stylized dithering to a sprite or image
  static applyStylizedDither(
    gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    options: DitherOptions = {}
  ): boolean {
    const { intensity = 1.0 } = options;
    const renderer = gameObject.scene.game.renderer;
    
    if (renderer.type !== Phaser.WEBGL) {
      console.warn('Stylized dithering shader requires WebGL renderer');
      return false;
    }

    try {
      // Apply the post-pipeline to the game object
      gameObject.setPostPipeline('StylizedDither');

      // Get the shader instance and set properties
      const shader = gameObject.getPostPipeline('StylizedDither') as StylizedDitherShader;
      if (!shader) {
        console.warn('StylizedDither shader not registered. Call registerStylizedDitherShader() first.');
        return false;
      }
      
      // Set shader properties - uniforms will be set in onPreRender
      shader.intensity = intensity;
      shader.resolution = { width: gameObject.width, height: gameObject.height };
      
      return true;
    } catch (error) {
      console.error('Failed to apply stylized dithering:', error);
      return false;
    }
  }


  // Remove stylized dithering from a game object
  static removeStylizedDithering(gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    gameObject.resetPipeline();
  }

  // Apply stylized dithering to all sprites in a container or group
  static applyStylizedDitherToGroup(
    group: Phaser.GameObjects.Container | Phaser.GameObjects.Group,
    options: DitherOptions = {}
  ): void {
    if (group instanceof Phaser.GameObjects.Container) {
      group.each((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Image || child instanceof Phaser.GameObjects.Sprite) {
          this.applyStylizedDither(child, options);
        }
      });
    } else if (group instanceof Phaser.GameObjects.Group) {
      group.children.entries.forEach((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Image || child instanceof Phaser.GameObjects.Sprite) {
          this.applyStylizedDither(child, options);
        }
      });
    }
  }
}