import type { WindowSkinOptions } from "../../draw-utils";
import { Palette } from "../../palette";
import { TextBlock } from "./TextBlock";
import { Window } from "./Window";

export interface ToggleOptions {
	x: number;
	y: number;
	width?: number;
	height?: number;
	initialValue?: boolean;
	labels?: { on: string; off: string };
	style?: "switch" | "checkbox" | "button";
	onToggle?: (value: boolean) => void;
}

/**
 * A Toggle primitive for on/off switches with visual state indicators.
 * Supports multiple visual styles and customizable labels.
 */
export class Toggle extends Phaser.GameObjects.Container {
	private background: Window;
	private indicator: Phaser.GameObjects.Graphics;
	private label?: TextBlock;
	private isOn: boolean;
	private switchTween?: Phaser.Tweens.Tween;

	constructor(
		scene: Phaser.Scene,
		private options: ToggleOptions,
	) {
		super(scene, options.x, options.y);

		this.isOn = options.initialValue ?? false;

		const width = options.width ?? 40;
		const height = options.height ?? 20;

		const windowOptions: WindowSkinOptions = {
			x: 0,
			y: 0,
			width,
			height,
			fillColor: this.isOn ? Palette.GREEN : Palette.DARK_GRAY,
		};

		this.background = new Window(scene, windowOptions);
		this.add(this.background);

		this.indicator = scene.add.graphics();
		this.add(this.indicator);

		if (options.labels) {
			this.label = new TextBlock(scene, {
				x: width + 8,
				y: height / 2,
				text: this.isOn ? options.labels.on : options.labels.off,
				fontKey: "retro",
				align: "left",
			});
			this.label.setOrigin(0, 0.5);
			this.add(this.label);
		}

		this.drawIndicator();
		this.setupInteractivity(width, height);

		scene.add.existing(this);
	}

	private drawIndicator() {
		this.indicator.clear();

		const width = this.options.width ?? 40;
		const height = this.options.height ?? 20;
		const style = this.options.style ?? "switch";

		switch (style) {
			case "switch":
				this.drawSwitchIndicator(width, height);
				break;
			case "checkbox":
				this.drawCheckboxIndicator(width, height);
				break;
			case "button":
				this.drawButtonIndicator(width, height);
				break;
		}
	}

	private drawSwitchIndicator(width: number, height: number) {
		const knobSize = height - 4;
		const knobX = this.isOn ? width - knobSize - 2 : 2;
		const knobY = 2;

		this.indicator.fillStyle(
			Phaser.Display.Color.HexStringToColor(Palette.WHITE).color,
		);
		this.indicator.fillRoundedRect(
			knobX,
			knobY,
			knobSize,
			knobSize,
			knobSize / 4,
		);
	}

	private drawCheckboxIndicator(width: number, height: number) {
		if (this.isOn) {
			this.indicator.lineStyle(
				2,
				Phaser.Display.Color.HexStringToColor(Palette.WHITE).color,
			);
			const centerX = width / 2;
			const centerY = height / 2;

			this.indicator.beginPath();
			this.indicator.moveTo(centerX - 6, centerY);
			this.indicator.lineTo(centerX - 2, centerY + 4);
			this.indicator.lineTo(centerX + 6, centerY - 4);
			this.indicator.strokePath();
		}
	}

	private drawButtonIndicator(width: number, height: number) {
		const color = this.isOn ? Palette.GREEN : Palette.RED;

		this.indicator.clear();
		this.indicator.fillStyle(
			Phaser.Display.Color.HexStringToColor(color).color,
		);
		this.indicator.fillCircle(
			width / 2,
			height / 2,
			Math.min(width, height) / 3,
		);
	}

	private setupInteractivity(width: number, height: number) {
		this.setSize(width, height);
		this.setInteractive({ useHandCursor: true }).on(
			"pointerup",
			this.handleToggle,
		);
	}

	private handleToggle = () => {
		this.toggle();
	};

	public toggle() {
		this.isOn = !this.isOn;
		this.updateVisualState();

		if (this.options.onToggle) {
			this.options.onToggle(this.isOn);
		}
	}

	public setValue(value: boolean, animate: boolean = true) {
		if (this.isOn === value) return;

		this.isOn = value;
		this.updateVisualState(animate);

		if (this.options.onToggle) {
			this.options.onToggle(this.isOn);
		}
	}

	private updateVisualState(animate: boolean = true) {
		const fillColor = this.isOn ? Palette.GREEN : Palette.DARK_GRAY;
		this.background.redraw({ fillColor });

		if (this.label && this.options.labels) {
			this.label.setText(
				this.isOn ? this.options.labels.on : this.options.labels.off,
			);
		}

		if (animate && this.options.style === "switch") {
			this.animateSwitchTransition();
		} else {
			this.drawIndicator();
		}
	}

	private animateSwitchTransition() {
		if (this.switchTween) {
			this.switchTween.destroy();
		}

		const width = this.options.width ?? 40;
		const height = this.options.height ?? 20;
		const knobSize = height - 4;
		const startX = this.isOn ? 2 : width - knobSize - 2;
		const endX = this.isOn ? width - knobSize - 2 : 2;

		this.switchTween = this.scene.tweens.add({
			targets: { x: startX },
			x: endX,
			duration: 150,
			ease: "Back.easeOut",
			onUpdate: (tween) => {
				const tweenedObject = tween.targets[0] as { x: number };
				this.indicator.clear();
				this.indicator.fillStyle(
					Phaser.Display.Color.HexStringToColor(Palette.WHITE).color,
				);
				this.indicator.fillRoundedRect(
					tweenedObject.x,
					2,
					knobSize,
					knobSize,
					knobSize / 4,
				);
			},
			onComplete: () => {
				this.switchTween = undefined;
			},
		});
	}

	public getValue(): boolean {
		return this.isOn;
	}

	public setFocus(isFocused: boolean) {
		const borderColor = isFocused ? Palette.YELLOW : undefined;
		this.background.redraw({ borderColor });
	}

	destroy() {
		if (this.switchTween) {
			this.switchTween.destroy();
		}
		super.destroy();
	}
}
