import { DrawUtils, type GaugeOptions } from "../../draw-utils";
import type { FontKey } from "../../fonts";
import { Palette } from "../../palette";

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
	animationDuration?: number;
}

/**
 * A ProgressBar primitive that wraps the drawGauge utility for HP/MP/XP bars.
 * Supports animated value changes and customizable visual styling.
 */
export class ProgressBar extends Phaser.GameObjects.Container {
	private graphics: Phaser.GameObjects.Graphics;
	private ghostGraphics: Phaser.GameObjects.Graphics;
	private textLabel: Phaser.GameObjects.Text | null = null;
	private currentValue: number;
	private targetValue: number;
	private ghostValue: number;
	private animationTween?: Phaser.Tweens.Tween;
	private ghostTween?: Phaser.Tweens.Tween;

	constructor(
		scene: Phaser.Scene,
		private options: ProgressBarOptions,
	) {
		super(scene, options.x, options.y);

		this.currentValue = Phaser.Math.Clamp(options.value, 0, options.maxValue);
		this.targetValue = this.currentValue;

		this.graphics = scene.add.graphics();
		this.ghostGraphics = scene.add.graphics();
		this.ghostValue = this.currentValue;

		// Ghost bar renders behind the main bar
		this.add(this.ghostGraphics);
		this.add(this.graphics);

		this.redraw();
		scene.add.existing(this);
	}

	/**
	 * Updates the progress bar value with optional animation and particle effects
	 */
	public setValue(value: number, animate: boolean = true) {
		const clampedValue = Phaser.Math.Clamp(value, 0, this.options.maxValue);
		const oldValue = this.currentValue;
		const valueDelta = clampedValue - oldValue;

		// Store old value in ghost bar before updating
		this.ghostValue = this.currentValue;
		this.targetValue = clampedValue;

		// Stop existing tweens
		if (this.animationTween) {
			this.animationTween.destroy();
			this.animationTween = undefined;
		}
		if (this.ghostTween) {
			this.ghostTween.destroy();
			this.ghostTween = undefined;
		}

		// Update main bar immediately to new value (SSOT)
		this.currentValue = clampedValue;
		this.redraw();

		// Trigger particle effects if there's a significant change
		if (
			Math.abs(valueDelta) > 0.1 &&
			this.scene &&
			"addPredefinedAnim" in this.scene
		) {
			const gaugeEndX =
				this.x +
				(this.options.width * Math.min(this.ghostValue, this.currentValue)) /
					this.options.maxValue;
			const gaugeEndY = this.y + this.options.height / 2;

			if (valueDelta < 0) {
				// Damage - red/orange particles
				(this.scene as any).addPredefinedAnim(
					"gauge_damage",
					gaugeEndX,
					gaugeEndY,
				);
			} else {
				// Heal - green/white particles
				(this.scene as any).addPredefinedAnim(
					"gauge_heal",
					gaugeEndX,
					gaugeEndY,
				);
			}
		}

		if (
			!animate ||
			this.options.animationDuration === 0 ||
			!this.scene ||
			!this.scene.tweens ||
			Math.abs(valueDelta) < 0.001
		) {
			// No animation needed - sync ghost bar immediately
			this.ghostValue = clampedValue;
			this.redraw();
			return;
		}

		// Animate ghost bar to trail behind main bar
		const ghostDuration = 600; // Slightly longer than original for more visible effect
		const ghostDelay = 100; // Small delay before ghost starts moving

		this.ghostTween = this.scene.tweens.add({
			targets: { value: this.ghostValue },
			value: clampedValue,
			duration: ghostDuration,
			delay: ghostDelay,
			ease: "Quad.easeOut",
			onUpdate: (tween) => {
				const tweenedObject = tween.targets[0] as { value: number };
				this.ghostValue = tweenedObject.value;
				this.redraw();
			},
			onComplete: () => {
				this.ghostValue = clampedValue;
				this.redraw();
				this.ghostTween = undefined;
			},
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
		return this.options.maxValue > 0
			? this.currentValue / this.options.maxValue
			: 0;
	}

	/**
	 * Checks if the progress bar is currently animating
	 */
	public isAnimating(): boolean {
		return this.animationTween !== undefined || this.ghostTween !== undefined;
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
		this.ghostGraphics.clear();

		if (this.textLabel) {
			this.textLabel.destroy();
			this.textLabel = null;
		}

		// Draw ghost bar first (if different from current value)
		if (Math.abs(this.ghostValue - this.currentValue) > 0.001) {
			const ghostOptions: GaugeOptions = {
				x: 0,
				y: 0,
				width: this.options.width,
				height: this.options.height,
				value: Math.round(this.ghostValue),
				maxValue: this.options.maxValue,
				borderColor: "transparent", // No border for ghost
				backgroundFillColor: "transparent", // No background for ghost
				gradientStart:
					this.ghostValue > this.currentValue
						? Palette.RED.hex
						: Palette.DARK_GREEN.hex,
				gradientEnd:
					this.ghostValue > this.currentValue
						? Palette.DARK_RED.hex
						: Palette.GREEN.hex,
				fontKey: this.options.fontKey ?? "retro",
				showValue: false,
				showMaxValue: false,
			};

			DrawUtils.drawGauge(this.scene, this.ghostGraphics, ghostOptions);

			// Make ghost bar semi-transparent
			this.ghostGraphics.setAlpha(0.6);
		}

		// Draw main bar
		const gaugeOptions: GaugeOptions = {
			x: 0,
			y: 0,
			width: this.options.width,
			height: this.options.height,
			value: Math.round(this.currentValue),
			maxValue: this.options.maxValue,
			borderColor: this.options.borderColor ?? Palette.WHITE.hex,
			backgroundFillColor:
				this.options.backgroundFillColor ?? Palette.DARK_PURPLE.hex,
			gradientStart: this.options.gradientStart ?? Palette.RED.hex,
			gradientEnd: this.options.gradientEnd ?? Palette.GREEN.hex,
			fontKey: this.options.fontKey ?? "retro",
			showValue: this.options.showValue ?? false,
			showMaxValue: this.options.showMaxValue ?? false,
		};

		this.textLabel = DrawUtils.drawGauge(
			this.scene,
			this.graphics,
			gaugeOptions,
		);

		if (this.textLabel) {
			this.add(this.textLabel);
		}
	}

	destroy() {
		if (this.animationTween) {
			this.animationTween.destroy();
		}
		if (this.ghostTween) {
			this.ghostTween.destroy();
		}
		super.destroy();
	}
}
