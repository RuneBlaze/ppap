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
  dithering?: 'floyd-steinberg' | 'ordered' | 'none';
  quantize?: boolean;
}

export interface DitherOptions {
  intensity?: number;
  paletteColors?: string[];
  pattern?: 'bayer' | 'blue-noise' | 'simple';
}

// Floyd-Steinberg dithering shader with GPU-friendly approximation
class FloydSteinbergDitherShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _intensity: number = 1.0;
  private _resolution: { width: number; height: number } = { width: 800, height: 600 };

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'FloydSteinbergDither',
      renderTarget: true,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float intensity;
uniform vec2 resolution;
uniform vec3 paletteColors[32];

varying vec2 outTexCoord;

// Convert hex color to vec3
vec3 quantizeToNearestPalette(vec3 color) {
    float minDistance = 999.0;
    vec3 nearestColor = paletteColors[0];
    
    for (int i = 0; i < 32; i++) {
        vec3 paletteColor = paletteColors[i];
        float distance = length(color - paletteColor);
        if (distance < minDistance) {
            minDistance = distance;
            nearestColor = paletteColor;
        }
    }
    
    return nearestColor;
}

// Pseudo-random number generator for dithering
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Floyd-Steinberg error diffusion approximation
vec3 floydSteinbergDither(vec2 uv, vec3 color) {
    vec2 pixelSize = 1.0 / resolution;
    
    // Sample neighboring pixels for error approximation
    vec3 rightPixel = texture2D(uMainSampler, uv + vec2(pixelSize.x, 0.0)).rgb;
    vec3 belowPixel = texture2D(uMainSampler, uv + vec2(0.0, pixelSize.y)).rgb;
    vec3 diagonalPixel = texture2D(uMainSampler, uv + vec2(pixelSize.x, pixelSize.y)).rgb;
    
    // Calculate quantization error
    vec3 quantized = quantizeToNearestPalette(color);
    vec3 error = color - quantized;
    
    // Distribute error to neighboring pixels (simplified)
    float errorWeight = intensity * 0.5;
    vec3 distributedError = error * errorWeight;
    
    // Add distributed error back to the quantized color
    vec3 finalColor = quantized + distributedError * (
        random(uv) * 0.4375 +  // Current pixel gets 7/16 of error
        random(uv + vec2(1.0, 0.0)) * 0.1875 +  // Right pixel gets 3/16
        random(uv + vec2(0.0, 1.0)) * 0.3125 +  // Below pixel gets 5/16
        random(uv + vec2(1.0, 1.0)) * 0.0625    // Diagonal pixel gets 1/16
    );
    
    return mix(color, quantizeToNearestPalette(finalColor), intensity);
}

void main() {
    vec2 uv = outTexCoord;
    vec4 color = texture2D(uMainSampler, uv);
    
    if (color.a < 0.1) {
        gl_FragColor = color;
        return;
    }
    
    vec3 ditheredColor = floydSteinbergDither(uv, color.rgb);
    gl_FragColor = vec4(ditheredColor, color.a);
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

// Ordered dithering shader (more GPU-friendly)
class OrderedDitherShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _intensity: number = 1.0;
  private _resolution: { width: number; height: number } = { width: 800, height: 600 };

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'OrderedDither',
      renderTarget: true,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float intensity;
uniform vec2 resolution;
uniform vec3 paletteColors[32];

varying vec2 outTexCoord;

// Bayer dithering matrix 4x4
float bayerMatrix[16];

void initBayerMatrix() {
    bayerMatrix[0] = 0.0;    bayerMatrix[1] = 8.0;    bayerMatrix[2] = 2.0;    bayerMatrix[3] = 10.0;
    bayerMatrix[4] = 12.0;   bayerMatrix[5] = 4.0;    bayerMatrix[6] = 14.0;   bayerMatrix[7] = 6.0;
    bayerMatrix[8] = 3.0;    bayerMatrix[9] = 11.0;   bayerMatrix[10] = 1.0;   bayerMatrix[11] = 9.0;
    bayerMatrix[12] = 15.0;  bayerMatrix[13] = 7.0;   bayerMatrix[14] = 13.0;  bayerMatrix[15] = 5.0;
}

vec3 quantizeToNearestPalette(vec3 color) {
    float minDistance = 999.0;
    vec3 nearestColor = paletteColors[0];
    
    for (int i = 0; i < 32; i++) {
        vec3 paletteColor = paletteColors[i];
        float distance = length(color - paletteColor);
        if (distance < minDistance) {
            minDistance = distance;
            nearestColor = paletteColor;
        }
    }
    
    return nearestColor;
}

vec3 orderedDither(vec2 uv, vec3 color) {
    initBayerMatrix();
    
    vec2 pixelPos = uv * resolution;
    int x = int(mod(pixelPos.x, 4.0));
    int y = int(mod(pixelPos.y, 4.0));
    int index = y * 4 + x;
    
    float threshold = bayerMatrix[index] / 16.0;
    
    // Apply dithering threshold
    vec3 ditheredColor = color + (threshold - 0.5) * intensity * 0.1;
    
    return quantizeToNearestPalette(ditheredColor);
}

void main() {
    vec2 uv = outTexCoord;
    vec4 color = texture2D(uMainSampler, uv);
    
    if (color.a < 0.1) {
        gl_FragColor = color;
        return;
    }
    
    vec3 ditheredColor = orderedDither(uv, color.rgb);
    gl_FragColor = vec4(mix(color.rgb, ditheredColor, intensity), color.a);
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
      dithering = 'none',
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
      if (dithering === 'none') {
        const gradientSteps = Math.max(1, fillWidth);
        const gradientColors = this.createGradientColors(gradientStart, gradientEnd, gradientSteps, quantize);
        
        // Draw gradient fill pixel by pixel for retro look
        for (let i = 0; i < fillWidth; i++) {
          const colorIndex = Math.floor((i / fillWidth) * (gradientColors.length - 1));
          const color = gradientColors[colorIndex];
          graphics.fillStyle(Phaser.Display.Color.HexStringToColor(color).color);
          graphics.fillRect(x + 1 + i, y + 1, 1, height - 2);
        }
      } else {
        // Create gradient imagedata for dithering
        const fillHeight = height - 2;
        const imageData = new Uint8ClampedArray(fillWidth * fillHeight * 4);
        
        // Fill imagedata with gradient
        for (let px = 0; px < fillWidth; px++) {
          const t = px / (fillWidth - 1);
          const interpolated = ColorUtils.interpolateOklab(gradientStart, gradientEnd, t);
          
          for (let py = 0; py < fillHeight; py++) {
            const i = (py * fillWidth + px) * 4;
            imageData[i] = interpolated.r;
            imageData[i + 1] = interpolated.g;
            imageData[i + 2] = interpolated.b;
            imageData[i + 3] = 255;
          }
        }
        
        // Apply dithering
        const ditheredData = dithering === 'floyd-steinberg' ? 
          ColorUtils.ditherFloydSteinberg(imageData, fillWidth, fillHeight) :
          ColorUtils.ditherOrdered(imageData, fillWidth, fillHeight);
        
        // Draw dithered pixels
        for (let px = 0; px < fillWidth; px++) {
          for (let py = 0; py < fillHeight; py++) {
            const i = (py * fillWidth + px) * 4;
            const r = ditheredData[i];
            const g = ditheredData[i + 1];
            const b = ditheredData[i + 2];
            
            const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            graphics.fillStyle(Phaser.Display.Color.HexStringToColor(hexColor).color);
            graphics.fillRect(x + 1 + px, y + 1 + py, 1, 1);
          }
        }
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
   * @param applyDithering - Whether to apply Floyd-Steinberg dithering (default: true)
   * @param ditherOptions - Options for dithering effect
   * @returns A new `Phaser.GameObjects.Image` instance for the icon.
   */
  static drawIcon(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    iconIndex: number, 
    applyDithering: boolean = true,
    ditherOptions: DitherOptions = {}
  ): Phaser.GameObjects.Image {
    const icon = scene.add.image(x, y, this.ICONS_KEY, iconIndex);
    
    if (applyDithering) {
      // Ensure dithering shaders are registered
      this.registerDitherShaders(scene.game);
      
      // Apply Floyd-Steinberg dithering by default
      this.applyFloydSteinbergDither(icon, ditherOptions);
    }
    
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

  // Register dithering shaders with the renderer
  static registerDitherShaders(game: Phaser.Game): void {
    const renderer = game.renderer;
    
    if (renderer.type === Phaser.WEBGL) {
      const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      
      try {
        // Register shaders using the pipeline manager's class registration method
        webglRenderer.pipelines.addPostPipeline('FloydSteinbergDither', FloydSteinbergDitherShader);
        webglRenderer.pipelines.addPostPipeline('OrderedDither', OrderedDitherShader);
        
        console.log('Dithering shaders registered successfully');
      } catch (error) {
        console.error('Failed to register dithering shaders:', error);
      }
    } else {
      console.warn('WebGL renderer not available for dithering shaders');
    }
  }

  // Apply Floyd-Steinberg dithering to a sprite or image
  static applyFloydSteinbergDither(
    gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    options: DitherOptions = {}
  ): boolean {
    const { intensity = 1.0 } = options;
    const renderer = gameObject.scene.game.renderer;
    
    if (renderer.type !== Phaser.WEBGL) {
      console.warn('Dithering shaders require WebGL renderer');
      return false;
    }

    try {
      // Apply the post-pipeline to the game object
      gameObject.setPostPipeline('FloydSteinbergDither');

      // Get the shader instance and set properties
      const shader = gameObject.getPostPipeline('FloydSteinbergDither') as FloydSteinbergDitherShader;
      if (!shader) {
        console.warn('FloydSteinbergDither shader not registered. Call registerDitherShaders() first.');
        return false;
      }
      
      // Set shader properties - uniforms will be set in onPreRender
      shader.intensity = intensity;
      shader.resolution = { width: gameObject.width, height: gameObject.height };
      
      return true;
    } catch (error) {
      console.error('Failed to apply Floyd-Steinberg dithering:', error);
      return false;
    }
  }

  // Apply ordered dithering to a sprite or image
  static applyOrderedDither(
    gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    options: DitherOptions = {}
  ): boolean {
    const { intensity = 1.0 } = options;
    const renderer = gameObject.scene.game.renderer;
    
    if (renderer.type !== Phaser.WEBGL) {
      console.warn('Dithering shaders require WebGL renderer');
      return false;
    }

    try {
      // Apply the post-pipeline to the game object
      gameObject.setPostPipeline('OrderedDither');
      
      // Get the shader instance and set properties
      const shader = gameObject.getPostPipeline('OrderedDither') as OrderedDitherShader;
      if (!shader) {
        console.warn('OrderedDither shader not registered. Call registerDitherShaders() first.');
        return false;
      }
      
      // Set shader properties - uniforms will be set in onPreRender
      shader.intensity = intensity;
      shader.resolution = { width: gameObject.width, height: gameObject.height };
      
      return true;
    } catch (error) {
      console.error('Failed to apply ordered dithering:', error);
      return false;
    }
  }

  // Remove dithering from a game object
  static removeDithering(gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    gameObject.resetPipeline();
  }

  // Apply dithering to all sprites in a container or group
  static applyDitherToGroup(
    group: Phaser.GameObjects.Container | Phaser.GameObjects.Group,
    ditherType: 'floyd-steinberg' | 'ordered' = 'ordered',
    options: DitherOptions = {}
  ): void {
    const applyFn = ditherType === 'floyd-steinberg' ? 
      this.applyFloydSteinbergDither.bind(this) : 
      this.applyOrderedDither.bind(this);

    if (group instanceof Phaser.GameObjects.Container) {
      group.each((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Image || child instanceof Phaser.GameObjects.Sprite) {
          applyFn(child, options);
        }
      });
    } else if (group instanceof Phaser.GameObjects.Group) {
      group.children.entries.forEach((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Image || child instanceof Phaser.GameObjects.Sprite) {
          applyFn(child, options);
        }
      });
    }
  }
}