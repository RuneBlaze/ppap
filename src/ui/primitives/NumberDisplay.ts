import { TextBlock, type TextBlockOptions } from "./TextBlock";

export interface NumberDisplayOptions extends Omit<TextBlockOptions, "text"> {
	value: number;
	animationDuration?: number;
	animationType?: "count" | "cycle" | "instant";
	formatValue?: (value: number) => string;
}

/**
 * A NumberDisplay primitive that extends TextBlock to add animations for value changes.
 * Supports counting up/down animations and cycling effects for RPG-style number displays.
 * Font size is automatically determined by the fontKey to preserve pixel-perfect rendering.
 */
export class NumberDisplay extends TextBlock {
	private currentValue: number;
	private targetValue: number;
	private animationTween?: Phaser.Tweens.Tween;
	private formatValue: (value: number) => string;

	constructor(
		scene: Phaser.Scene,
		private options: NumberDisplayOptions,
	) {
		const textOptions: TextBlockOptions = {
			...options,
			text: options.formatValue
				? options.formatValue(options.value)
				: options.value.toString(),
		};

		super(scene, textOptions);

		this.currentValue = options.value;
		this.targetValue = options.value;
		this.formatValue = options.formatValue || ((val: number) => val.toString());
	}

	/**
	 * Updates the displayed value with optional animation
	 */
	setValue(newValue: number, animate: boolean = true) {
		if (this.animationTween) {
			this.animationTween.destroy();
			this.animationTween = undefined;
		}

		this.targetValue = newValue;

		if (!animate || this.options.animationType === "instant") {
			this.currentValue = newValue;
			this.updateDisplayText();
			return;
		}

		const duration = this.options.animationDuration || 500;
		const startValue = this.currentValue;

		switch (this.options.animationType) {
			case "cycle":
				this.animateCycle(startValue, newValue, duration);
				break;
			default:
				this.animateCount(startValue, newValue, duration);
				break;
		}
	}

	private animateCount(from: number, to: number, duration: number) {
		this.animationTween = this.scene.tweens.add({
			targets: { value: from },
			value: to,
			duration,
			ease: "Quad.easeOut",
			onUpdate: (tween) => {
				const tweenedObject = tween.targets[0] as { value: number };
				this.currentValue = Math.round(tweenedObject.value);
				this.updateDisplayText();
			},
			onComplete: () => {
				this.currentValue = to;
				this.updateDisplayText();
				this.animationTween = undefined;
			},
		});
	}

	private animateCycle(from: number, to: number, duration: number) {
		const steps = Math.min(Math.abs(to - from), 20);
		const stepDuration = duration / (steps + 2);

		let currentStep = 0;
		const randomValues: number[] = [];

		for (let i = 0; i < steps; i++) {
			randomValues.push(Math.floor(Math.random() * Math.max(from, to)));
		}

		const cycleNext = () => {
			if (currentStep < steps) {
				this.currentValue = randomValues[currentStep];
				this.updateDisplayText();
				currentStep++;
				this.scene.time.delayedCall(stepDuration, cycleNext);
			} else {
				this.currentValue = to;
				this.updateDisplayText();
			}
		};

		cycleNext();
	}

	private updateDisplayText() {
		const formattedValue = this.formatValue(this.currentValue);
		this.setText(formattedValue);
	}

	/**
	 * Gets the current displayed value (may be different from target during animation)
	 */
	getCurrentValue(): number {
		return this.currentValue;
	}

	/**
	 * Gets the target value
	 */
	getTargetValue(): number {
		return this.targetValue;
	}

	/**
	 * Checks if the display is currently animating
	 */
	isAnimating(): boolean {
		return this.animationTween !== undefined;
	}

	destroy() {
		if (this.animationTween) {
			this.animationTween.destroy();
		}
		super.destroy();
	}
}
