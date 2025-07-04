import type { WindowSkinOptions } from "../../draw-utils";
import { getFontStyle } from "../../fonts";
import { Palette } from "../../palette";
import { Window } from "./Window";

export interface SliderOptions {
	x: number;
	y: number;
	width: number;
	height?: number;
	min: number;
	max: number;
	value: number;
	step?: number;
	orientation?: "horizontal" | "vertical";
	showValue?: boolean;
	onValueChange?: (value: number) => void;
}

/**
 * A Slider primitive for value adjustment controls with draggable handle.
 * Supports horizontal/vertical orientations and customizable value ranges.
 */
export class Slider extends Phaser.GameObjects.Container {
	private track: Window;
	private handle: Window;
	private valueText?: Phaser.GameObjects.Text;
	private currentValue: number;
	private isDragging = false;
	private dragOffset = 0;

	constructor(
		scene: Phaser.Scene,
		private options: SliderOptions,
	) {
		super(scene, options.x, options.y);

		this.currentValue = Phaser.Math.Clamp(
			options.value,
			options.min,
			options.max,
		);

		const width = options.width;
		const height = options.height ?? 16;
		const isHorizontal = (options.orientation ?? "horizontal") === "horizontal";

		const trackOptions: WindowSkinOptions = {
			x: 0,
			y: isHorizontal ? height / 2 - 2 : 0,
			width: isHorizontal ? width : 4,
			height: isHorizontal ? 4 : height,
			fillColor: Palette.DARK_GRAY,
			borderColor: Palette.GRAY,
		};

		this.track = new Window(scene, trackOptions);
		this.add(this.track);

		const handleSize = isHorizontal ? height : width;
		const handleOptions: WindowSkinOptions = {
			x: 0,
			y: 0,
			width: isHorizontal ? handleSize : width,
			height: isHorizontal ? height : handleSize,
			fillColor: Palette.GRAY,
			borderColor: Palette.WHITE,
		};

		this.handle = new Window(scene, handleOptions);
		this.add(this.handle);

		if (options.showValue) {
			const fontStyle = getFontStyle("retro");
			this.valueText = scene.add.text(
				isHorizontal ? width / 2 : width + 8,
				isHorizontal ? height + 8 : height / 2,
				this.currentValue.toString(),
				{
					...fontStyle,
					color: Palette.WHITE,
				},
			);
			this.valueText.setOrigin(0.5, 0);
			this.add(this.valueText);
		}

		this.updateHandlePosition();
		this.setupInteractivity(width, height);

		scene.add.existing(this);
	}

	private setupInteractivity(width: number, height: number) {
		this.setSize(width, height);
		this.setInteractive({ useHandCursor: true })
			.on("pointerdown", this.handlePointerDown)
			.on("pointermove", this.handlePointerMove)
			.on("pointerup", this.handlePointerUp)
			.on("pointerupoutside", this.handlePointerUp);
	}

	private handlePointerDown = (pointer: Phaser.Input.Pointer) => {
		this.isDragging = true;

		const isHorizontal =
			(this.options.orientation ?? "horizontal") === "horizontal";
		const localPoint = this.getLocalCoordinates(pointer.x, pointer.y);

		if (isHorizontal) {
			this.dragOffset = localPoint.x - this.handle.x;
		} else {
			this.dragOffset = localPoint.y - this.handle.y;
		}
	};

	private handlePointerMove = (pointer: Phaser.Input.Pointer) => {
		if (!this.isDragging) return;

		const localPoint = this.getLocalCoordinates(pointer.x, pointer.y);
		const isHorizontal =
			(this.options.orientation ?? "horizontal") === "horizontal";
		const height = this.options.height ?? 16;

		let newPosition: number;
		let maxPosition: number;

		if (isHorizontal) {
			newPosition = localPoint.x - this.dragOffset;
			maxPosition = this.options.width - height;
		} else {
			newPosition = localPoint.y - this.dragOffset;
			maxPosition = height - this.options.width;
		}

		newPosition = Phaser.Math.Clamp(newPosition, 0, maxPosition);

		const normalizedValue = newPosition / maxPosition;
		const range = this.options.max - this.options.min;
		let newValue = this.options.min + normalizedValue * range;

		if (this.options.step) {
			newValue = Math.round(newValue / this.options.step) * this.options.step;
		}

		this.setValue(newValue, false);
	};

	private handlePointerUp = () => {
		this.isDragging = false;
		this.handle.redraw({ fillColor: Palette.GRAY });
	};

	private getLocalCoordinates(
		worldX: number,
		worldY: number,
	): { x: number; y: number } {
		const bounds = this.getBounds();
		return {
			x: worldX - bounds.x,
			y: worldY - bounds.y,
		};
	}

	private updateHandlePosition() {
		const isHorizontal =
			(this.options.orientation ?? "horizontal") === "horizontal";
		const range = this.options.max - this.options.min;
		const normalizedValue = (this.currentValue - this.options.min) / range;

		if (isHorizontal) {
			const height = this.options.height ?? 16;
			const maxPosition = this.options.width - height;
			this.handle.x = normalizedValue * maxPosition;
		} else {
			const maxPosition = this.options.height! - this.options.width;
			this.handle.y = normalizedValue * maxPosition;
		}

		if (this.valueText) {
			this.valueText.setText(this.currentValue.toString());
		}
	}

	public setValue(value: number, callCallback: boolean = true) {
		const clampedValue = Phaser.Math.Clamp(
			value,
			this.options.min,
			this.options.max,
		);

		if (this.currentValue === clampedValue) return;

		this.currentValue = clampedValue;
		this.updateHandlePosition();

		if (callCallback && this.options.onValueChange) {
			this.options.onValueChange(this.currentValue);
		}
	}

	public getValue(): number {
		return this.currentValue;
	}

	public setFocus(isFocused: boolean) {
		const borderColor = isFocused ? Palette.YELLOW : Palette.WHITE;
		this.handle.redraw({ borderColor });
	}

	public incrementValue() {
		const step = this.options.step ?? 1;
		this.setValue(this.currentValue + step);
	}

	public decrementValue() {
		const step = this.options.step ?? 1;
		this.setValue(this.currentValue - step);
	}

	public setRange(min: number, max: number) {
		this.options.min = min;
		this.options.max = max;
		this.setValue(this.currentValue);
	}

	destroy() {
		super.destroy();
	}
}
