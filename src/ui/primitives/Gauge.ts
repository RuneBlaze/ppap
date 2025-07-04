import type { FontKey } from "../../fonts";
import { Palette } from "../../palette";
import { TextBlock } from "./TextBlock";

export interface GaugeOptions {
	x: number;
	y: number;
	radius: number;
	value: number;
	maxValue: number;
	startAngle?: number;
	endAngle?: number;
	thickness?: number;
	backgroundColor?: string;
	fillColor?: string;
	borderColor?: string;
	showValue?: boolean;
	fontKey?: FontKey;
	animationDuration?: number;
}

/**
 * A circular/radial Gauge primitive for ATB gauges, charging meters, and other circular progress indicators.
 * Supports customizable angles, colors, and animations.
 * Font size is automatically determined by the fontKey to preserve pixel-perfect rendering.
 */
export class Gauge extends Phaser.GameObjects.Container {
	private graphics: Phaser.GameObjects.Graphics;
	private valueText?: TextBlock;
	private currentValue: number;
	private targetValue: number;
	private animationTween?: Phaser.Tweens.Tween;

	constructor(
		scene: Phaser.Scene,
		private options: GaugeOptions,
	) {
		super(scene, options.x, options.y);

		this.currentValue = Phaser.Math.Clamp(options.value, 0, options.maxValue);
		this.targetValue = this.currentValue;

		this.graphics = scene.add.graphics();
		this.add(this.graphics);

		if (options.showValue) {
			this.valueText = new TextBlock(scene, {
				x: 0,
				y: 0,
				text: Math.round(this.currentValue).toString(),
				fontKey: options.fontKey ?? "retro",
				color: Palette.WHITE.hex,
				align: "center",
			});
			this.valueText.setOrigin(0.5);
			this.add(this.valueText);
		}

		this.redraw();
		scene.add.existing(this);
	}

	/**
	 * Updates the gauge value with optional animation
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
			ease: "Quad.easeOut",
			onUpdate: (tween) => {
				const tweenedObject = tween.targets[0] as { value: number };
				this.currentValue = tweenedObject.value;
				this.redraw();
			},
			onComplete: () => {
				this.currentValue = clampedValue;
				this.redraw();
				this.animationTween = undefined;
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
	 * Gets the current displayed value
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
	 * Checks if the gauge is currently animating
	 */
	public isAnimating(): boolean {
		return this.animationTween !== undefined;
	}

	/**
	 * Updates the visual styling options
	 */
	public updateStyle(newOptions: Partial<GaugeOptions>) {
		this.options = { ...this.options, ...newOptions };
		this.redraw();
	}

	private redraw() {
		this.graphics.clear();

		const {
			radius,
			startAngle = -Math.PI / 2, // Start at top (-90 degrees)
			endAngle = Math.PI * 1.5, // End at top (270 degrees) for full circle
			thickness = 8,
			backgroundColor = Palette.DARK_GRAY.hex,
			fillColor = Palette.GREEN.hex,
			borderColor = Palette.WHITE.hex,
		} = this.options;

		const fillPercentage = this.getFillPercentage();
		const totalAngle = endAngle - startAngle;
		const fillAngle = startAngle + totalAngle * fillPercentage;

		// Draw background arc
		this.graphics.lineStyle(
			thickness,
			Phaser.Display.Color.HexStringToColor(backgroundColor).color,
		);
		this.graphics.beginPath();
		this.graphics.arc(0, 0, radius, startAngle, endAngle);
		this.graphics.strokePath();

		// Draw fill arc
		if (fillPercentage > 0) {
			this.graphics.lineStyle(
				thickness,
				Phaser.Display.Color.HexStringToColor(fillColor).color,
			);
			this.graphics.beginPath();
			this.graphics.arc(0, 0, radius, startAngle, fillAngle);
			this.graphics.strokePath();
		}

		// Draw border
		if (borderColor) {
			this.graphics.lineStyle(
				1,
				Phaser.Display.Color.HexStringToColor(borderColor).color,
			);
			this.graphics.beginPath();
			this.graphics.arc(0, 0, radius + thickness / 2, startAngle, endAngle);
			this.graphics.strokePath();

			this.graphics.beginPath();
			this.graphics.arc(0, 0, radius - thickness / 2, startAngle, endAngle);
			this.graphics.strokePath();
		}

		// Update value text
		if (this.valueText) {
			this.valueText.setText(Math.round(this.currentValue).toString());
		}
	}

	destroy() {
		if (this.animationTween) {
			this.animationTween.destroy();
		}
		super.destroy();
	}
}
