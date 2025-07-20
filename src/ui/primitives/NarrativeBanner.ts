import { type FontKey, getFontStyle } from "../../fonts";
import { Palette } from "../../palette";

export interface NarrativeBannerOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	fontKey?: FontKey;
	maxLines?: number;
}

/**
 * A NarrativeBanner primitive for displaying streaming narrative text at the top of the screen.
 * Shows the most recent message at full opacity with previous messages fading out,
 * similar to Pokemon Black 2/White 2 style.
 */
export class NarrativeBanner extends Phaser.GameObjects.Container {
	private readonly options: Required<NarrativeBannerOptions>;
	private readonly textLines: Phaser.GameObjects.Text[] = [];
	private readonly fadeTime = 2000; // Time before text starts fading
	private readonly fadeDuration = 1500; // Duration of fade animation

	constructor(scene: Phaser.Scene, options: NarrativeBannerOptions) {
		super(scene, options.x, options.y);

		this.options = {
			...options,
			fontKey: options.fontKey ?? "everydayStandard",
			maxLines: options.maxLines ?? 3,
		};

		// Create background (optional - can be transparent)
		const background = scene.add.graphics();
		background.fillStyle(Palette.BLACK.num, 0.7);
		background.fillRect(0, 0, this.options.width, this.options.height);
		this.add(background);

		scene.add.existing(this);
		this.setDepth(1000); // High depth to appear above other UI elements
	}

	/**
	 * Add a new line of narrative text
	 */
	public addText(text: string): void {
		// Clean up text - remove extra whitespace and trim
		const cleanText = text.trim();
		if (!cleanText) return;

		// Create new text object
		const style = getFontStyle(this.options.fontKey);
		style.color = Palette.WHITE.hex;
		style.align = "left";
		style.wordWrap = {
			width: this.options.width - 16, // 8px padding on each side
			useAdvancedWrap: true,
		};

		const textObject = this.scene.add.text(8, 0, cleanText, style);
		this.add(textObject);
		this.textLines.push(textObject);

		// Position all text lines
		this.repositionTextLines();

		// Start fade timer for this text
		this.scene.time.delayedCall(this.fadeTime, () => {
			this.fadeOutText(textObject);
		});

		// Remove excess lines if we exceed maxLines
		this.trimExcessLines();
	}

	/**
	 * Reposition all text lines vertically
	 */
	private repositionTextLines(): void {
		const lineHeight = 16; // Standard line height for our font
		let currentY = 8; // Start with 8px padding from top

		for (let i = this.textLines.length - 1; i >= 0; i--) {
			const textObj = this.textLines[i];
			if (textObj?.active) {
				textObj.setY(currentY);
				currentY += lineHeight;

				// Stop if we exceed the banner height
				if (currentY > this.options.height - 8) {
					break;
				}
			}
		}
	}

	/**
	 * Fade out a text object
	 */
	private fadeOutText(textObject: Phaser.GameObjects.Text): void {
		if (!textObject || !textObject.active) return;

		this.scene.tweens.add({
			targets: textObject,
			alpha: { from: 1, to: 0.3 },
			duration: this.fadeDuration,
			ease: "Power2.easeOut",
		});
	}

	/**
	 * Remove excess text lines beyond maxLines
	 */
	private trimExcessLines(): void {
		while (this.textLines.length > this.options.maxLines) {
			const oldestText = this.textLines.shift();
			if (oldestText) {
				// Fade out and destroy the oldest text
				this.scene.tweens.add({
					targets: oldestText,
					alpha: { from: oldestText.alpha, to: 0 },
					duration: 300,
					ease: "Power2.easeOut",
					onComplete: () => {
						this.remove(oldestText);
						oldestText.destroy();
					},
				});
			}
		}
	}

	/**
	 * Clear all text from the banner
	 */
	public clear(): void {
		for (const textObj of this.textLines) {
			if (textObj?.active) {
				this.remove(textObj);
				textObj.destroy();
			}
		}
		this.textLines.length = 0;
	}

	/**
	 * Hide the banner with animation
	 */
	public hide(): void {
		this.scene.tweens.add({
			targets: this,
			alpha: { from: this.alpha, to: 0 },
			duration: 500,
			ease: "Power2.easeOut",
		});
	}

	/**
	 * Show the banner with animation
	 */
	public show(): void {
		this.scene.tweens.add({
			targets: this,
			alpha: { from: this.alpha, to: 1 },
			duration: 500,
			ease: "Power2.easeOut",
		});
	}
}
