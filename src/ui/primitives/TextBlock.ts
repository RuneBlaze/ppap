import { type FontKey, getFontStyle } from "../../fonts";
import { Palette } from "../../palette";

export interface TextBlockOptions {
	x: number;
	y: number;
	text: string | string[];
	fontKey: FontKey;
	color?: string;
	wordWrapWidth?: number;
	align?: "left" | "right" | "center";
}

/**
 * A TextBlock primitive for displaying text with consistent styling.
 * It uses the `getFontStyle` helper to ensure all text in the game
 * follows the established typographic standards.
 * Font size is automatically determined by the fontKey and cannot be overridden
 * to preserve pixel-perfect rendering of pixel fonts.
 */
export class TextBlock extends Phaser.GameObjects.Text {
	constructor(scene: Phaser.Scene, options: TextBlockOptions) {
		// Use the font size defined in fonts.ts - no manual override allowed
		const style = getFontStyle(options.fontKey);
		style.color = options.color ?? Palette.WHITE;
		style.align = options.align ?? "left";

		if (options.wordWrapWidth) {
			style.wordWrap = { width: options.wordWrapWidth, useAdvancedWrap: true };
		}

		super(scene, options.x, options.y, options.text, style);
		scene.add.existing(this);
	}
}
