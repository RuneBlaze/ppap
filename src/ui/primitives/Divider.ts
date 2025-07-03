import { Palette } from '../../palette';

export interface DividerOptions {
  x: number;
  y: number;
  width: number;
  height?: number;
  orientation?: 'horizontal' | 'vertical';
  style?: 'line' | 'dotted' | 'decorative';
  color?: string;
  thickness?: number;
}

/**
 * A decorative divider primitive for separating UI sections.
 * Supports horizontal/vertical orientations and different visual styles.
 */
export class Divider extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, private options: DividerOptions) {
    super(scene);
    this.x = options.x;
    this.y = options.y;
    this.draw();
    scene.add.existing(this);
  }

  private draw() {
    this.clear();
    
    const {
      width,
      height = 2,
      orientation = 'horizontal',
      style = 'line',
      color = Palette.GRAY,
      thickness = 1
    } = this.options;

    const colorHex = Phaser.Display.Color.HexStringToColor(color).color;

    switch (style) {
      case 'line':
        this.lineStyle(thickness, colorHex);
        if (orientation === 'horizontal') {
          this.lineTo(width, 0);
        } else {
          this.moveTo(0, 0);
          this.lineTo(0, height);
        }
        this.strokePath();
        break;

      case 'dotted':
        this.fillStyle(colorHex);
        const dotSize = thickness;
        const spacing = dotSize * 2;
        
        if (orientation === 'horizontal') {
          for (let x = 0; x < width; x += spacing) {
            this.fillCircle(x, 0, dotSize / 2);
          }
        } else {
          for (let y = 0; y < height; y += spacing) {
            this.fillCircle(0, y, dotSize / 2);
          }
        }
        break;

      case 'decorative':
        this.lineStyle(thickness, colorHex);
        const centerX = width / 2;
        const centerY = height / 2;
        
        if (orientation === 'horizontal') {
          this.moveTo(0, 0);
          this.lineTo(centerX - 8, 0);
          this.fillStyle(colorHex);
          this.fillCircle(centerX, 0, 2);
          this.moveTo(centerX + 8, 0);
          this.lineTo(width, 0);
          this.strokePath();
        } else {
          this.moveTo(0, 0);
          this.lineTo(0, centerY - 8);
          this.fillStyle(colorHex);
          this.fillCircle(0, centerY, 2);
          this.moveTo(0, centerY + 8);
          this.lineTo(0, height);
          this.strokePath();
        }
        break;
    }
  }

  redraw(newOptions: Partial<DividerOptions>) {
    this.options = { ...this.options, ...newOptions };
    this.draw();
  }
} 