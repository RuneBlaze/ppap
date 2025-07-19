import { type FontKey, getFontStyle } from "../../fonts";
import { Palette } from "../../palette";

export interface SubjectBannerOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	fontKey?: FontKey;
}

/**
 * A SubjectBanner for displaying prominent "subject" text for the current action.
 * Similar to JRPG battle systems where skill names are displayed in a banner.
 * Uses the Capital Hill font for emphasis and prominence.
 */
export class SubjectBanner extends Phaser.GameObjects.Container {
	private readonly options: Required<SubjectBannerOptions>;
	private currentText: Phaser.GameObjects.Text | null = null;

	constructor(scene: Phaser.Scene, options: SubjectBannerOptions) {
		super(scene, options.x, options.y);

		this.options = {
			...options,
			fontKey: options.fontKey ?? "capitalHill", // Use Capital Hill font for emphasis
		};

		// Create background with prominent JRPG styling
		const background = scene.add.graphics();
		background.fillStyle(Palette.BLACK.num, 0.8);
		background.fillRect(0, 0, this.options.width, this.options.height);

		// Add decorative borders for JRPG style
		background.lineStyle(2, Palette.GOLD.num, 0.8);
		background.strokeRect(0, 0, this.options.width, this.options.height);

		// Inner highlight border
		background.lineStyle(1, Palette.WHITE.num, 0.4);
		background.strokeRect(
			2,
			2,
			this.options.width - 4,
			this.options.height - 4,
		);

		this.add(background);

		scene.add.existing(this);
		this.setDepth(1000); // High depth to appear above other UI elements
	}

	/**
	 * Display subject text prominently
	 */
	public setSubject(subject: string): void {
		// Clean up text
		let cleanText = subject.trim();
		if (!cleanText) {
			this.hide();
			return;
		}

		// Truncate if too long to fit in compact banner
		if (cleanText.length > 20) {
			cleanText = cleanText.substring(0, 17) + "...";
		}

		// Clear existing text
		if (this.currentText) {
			this.currentText.destroy();
		}

		// Create new text object with compact styling
		const style = getFontStyle(this.options.fontKey);
		style.color = Palette.GOLD.hex; // Gold color for prominence
		style.align = "center";
		style.stroke = Palette.BLACK.hex;
		style.strokeThickness = 1;
		style.wordWrap = {
			width: this.options.width - 8, // Small padding
			useAdvancedWrap: true,
		};

		this.currentText = this.scene.add.text(
			this.options.width / 2,
			this.options.height / 2,
			cleanText.toUpperCase(), // Uppercase for JRPG style
			style,
		);
		this.currentText.setOrigin(0.5, 0.5); // Center the text
		this.add(this.currentText);

		// Show the banner if it's hidden
		if (this.alpha === 0) {
			this.show();
		}

		// Animate the text entry
		this.currentText.setScale(0.8);
		this.currentText.setAlpha(0);
		this.scene.tweens.add({
			targets: this.currentText,
			scale: { from: 0.8, to: 1 },
			alpha: { from: 0, to: 1 },
			duration: 300,
			ease: "Back.easeOut",
		});
	}

	/**
	 * Clear the subject text
	 */
	public clear(): void {
		if (this.currentText) {
			this.currentText.destroy();
			this.currentText = null;
		}
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
