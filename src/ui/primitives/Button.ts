import type { WindowSkinOptions } from "../../draw-utils";
import { Palette } from "../../palette";
import { TextBlock } from "./TextBlock";
import { Window } from "./Window";

export interface ButtonOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	onPointerUp?: (button: any) => void;
}

/**
 * A composite Button primitive built from a Window and a TextBlock.
 * It handles pointer interactions and provides visual feedback for
 * hover and press states.
 */
export class Button extends Phaser.GameObjects.Container {
	private background: Window;
	private textBlock: TextBlock;
	private isHovered = false;

	constructor(
		scene: Phaser.Scene,
		public options: ButtonOptions,
	) {
		super(scene, options.x, options.y);

		const windowOptions: WindowSkinOptions = {
			x: 0,
			y: 0,
			width: options.width,
			height: options.height,
			fillColor: Palette.DARK_PURPLE.hex,
		};

		this.background = new Window(scene, windowOptions);
		this.add(this.background);

		this.textBlock = new TextBlock(scene, {
			x: options.width / 2,
			y: options.height / 2,
			text: options.text,
			fontKey: "retro",
			align: "center",
		});
		this.textBlock.setOrigin(0.5);
		this.add(this.textBlock);

		this.setSize(options.width, options.height);
		this.setInteractive({ useHandCursor: true })
			.on("pointerover", this.handlePointerOver)
			.on("pointerout", this.handlePointerOut)
			.on("pointerup", this.handlePointerUp);

		scene.add.existing(this);
	}

	private handlePointerOver = () => {
		this.isHovered = true;
		this.updateVisualState();
	};

	private handlePointerOut = () => {
		this.isHovered = false;
		this.updateVisualState();
	};

	private handlePointerUp = () => {
		if (this.options.onPointerUp) {
			this.options.onPointerUp(this);
		}
	};

	private updateVisualState() {
		const fillColor = this.isHovered
			? Palette.PURPLE.hex
			: Palette.DARK_PURPLE.hex;
		this.background.redraw({ fillColor });
	}

	setFocus(isFocused: boolean) {
		this.isHovered = isFocused;
		this.updateVisualState();
	}
}
