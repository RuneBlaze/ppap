import { DrawUtils, type GaugeOptions } from '../../draw-utils';
import { Palette } from '../../palette';
import { type FontKey } from '../../fonts';

export interface ProgressBarOptions {
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
  animationDuration?: number;
}

/**
 * A ProgressBar primitive that wraps the drawGauge utility for HP/MP/XP bars.
 * Supports animated value changes and customizable visual styling.
 */
export class ProgressBar extends Phaser.GameObjects.Container {
  private graphics: Phaser.GameObjects.Graphics;
  private textLabel: Phaser.GameObjects.Text | null = null;
  private currentValue: number;
  private targetValue: number;
  private animationTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, private options: ProgressBarOptions) {
    super(scene, options.x, options.y);
    
    this.currentValue = Phaser.Math.Clamp(options.value, 0, options.maxValue);
    this.targetValue = this.currentValue;
    
    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    
    this.redraw();
    scene.add.existing(this);
  }

  /**
   * Updates the progress bar value with optional animation
   */
  public setValue(value: number, animate: boolean = true) {
    const clampedValue = Phaser.Math.Clamp(value, 0, this.options.maxValue);
    this.targetValue = clampedValue;

    if (this.animationTween) {
      this.animationTween.destroy();
      this.animationTween = undefined;
    }

    if (!animate || this.options.animationDuration === 0) {
      this.currentValue = clampedValue;
      this.redraw();
      return;
    }

    const duration = this.options.animationDuration ?? 300;
    
    this.animationTween = this.scene.tweens.add({
      targets: { value: this.currentValue },
      value: clampedValue,
      duration,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const tweenedObject = tween.targets[0] as { value: number };
        this.currentValue = tweenedObject.value;
        this.redraw();
      },
      onComplete: () => {
        this.currentValue = clampedValue;
        this.redraw();
        this.animationTween = undefined;
      }
    });
  }

  /**
   * Updates the maximum value and adjusts current value if needed
   */
  public setMaxValue(maxValue: number) {
    this.options.maxValue = maxValue;
    if (this.currentValue > maxValue) {
      this.setValue(maxValue, false);
    } else {
      this.redraw();
    }
  }

  /**
   * Gets the current displayed value (may be different from target during animation)
   */
  public getCurrentValue(): number {
    return this.currentValue;
  }

  /**
   * Gets the target value
   */
  public getTargetValue(): number {
    return this.targetValue;
  }

  /**
   * Gets the maximum value
   */
  public getMaxValue(): number {
    return this.options.maxValue;
  }

  /**
   * Gets the current fill percentage (0-1)
   */
  public getFillPercentage(): number {
    return this.options.maxValue > 0 ? this.currentValue / this.options.maxValue : 0;
  }

  /**
   * Checks if the progress bar is currently animating
   */
  public isAnimating(): boolean {
    return this.animationTween !== undefined;
  }

  /**
   * Updates the visual styling options
   */
  public updateStyle(newOptions: Partial<ProgressBarOptions>) {
    this.options = { ...this.options, ...newOptions };
    this.redraw();
  }

  private redraw() {
    this.graphics.clear();
    
    if (this.textLabel) {
      this.textLabel.destroy();
      this.textLabel = null;
    }

    const gaugeOptions: GaugeOptions = {
      x: 0,
      y: 0,
      width: this.options.width,
      height: this.options.height,
      value: Math.round(this.currentValue),
      maxValue: this.options.maxValue,
      borderColor: this.options.borderColor ?? Palette.WHITE,
      backgroundFillColor: this.options.backgroundFillColor ?? Palette.DARK_PURPLE,
      gradientStart: this.options.gradientStart ?? Palette.RED,
      gradientEnd: this.options.gradientEnd ?? Palette.GREEN,
      fontKey: this.options.fontKey ?? 'retro',
      showValue: this.options.showValue ?? false,
      showMaxValue: this.options.showMaxValue ?? false,
      dithering: this.options.dithering ?? 'none'
    };

    this.textLabel = DrawUtils.drawGauge(this.scene, this.graphics, gaugeOptions);
    
    if (this.textLabel) {
      this.add(this.textLabel);
    }
  }

  destroy() {
    if (this.animationTween) {
      this.animationTween.destroy();
    }
    super.destroy();
  }
} 