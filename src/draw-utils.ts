import { Palette } from './palette';
import { type FontKey, getFontStyle, fonts } from './fonts';
import { ColorUtils } from './color-utils';

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
}

export class DrawUtils {
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

  // Create gradient colors and quantize to palette
  static createGradientColors(
    startColor: string,
    endColor: string,
    steps: number
  ): string[] {
    const colors: string[] = [];
    
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const interpolated = ColorUtils.interpolateOklab(startColor, endColor, t);
      const quantized = ColorUtils.quantizeToPalette(interpolated);
      colors.push(quantized);
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
      dithering = 'none'
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
        const gradientColors = this.createGradientColors(gradientStart, gradientEnd, gradientSteps);
        
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
}