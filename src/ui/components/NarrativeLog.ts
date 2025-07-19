import { type FontKey, getFontStyle } from "../../fonts";
import { Palette } from "../../palette";

export interface NarrativeLogOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	fontKey?: FontKey;
	maxLines?: number;
}

/**
 * A roguelike-style scrolling narrative log that shows a history of messages.
 * Parses sentences in real-time and displays them with the most recent prominent.
 */
export class NarrativeLog extends Phaser.GameObjects.Container {
	private readonly options: Required<NarrativeLogOptions>;
	private readonly sentences: string[] = [];
	private readonly textLines: Phaser.GameObjects.Text[] = [];
	private currentPartialSentence = "";
	private readonly lineHeight = 8;

	constructor(scene: Phaser.Scene, options: NarrativeLogOptions) {
		super(scene, options.x, options.y);

		this.options = {
			...options,
			fontKey: options.fontKey ?? "everydayStandard",
			maxLines: options.maxLines ?? 3,
		};

		this.createBackground();
		scene.add.existing(this);
		this.setDepth(500); // Medium depth - above background, below popups
	}

	private createBackground(): void {
		// Create a semi-transparent dark background
		const background = this.scene.add.graphics();
		background.fillStyle(Palette.BLACK.num, 0.8);
		background.fillRect(0, 0, this.options.width, this.options.height);

		// Add a subtle border
		background.lineStyle(1, Palette.DARK_GRAY.num, 0.6);
		background.strokeRect(0, 0, this.options.width, this.options.height);

		this.add(background);
	}

	/**
	 * Add streaming narrative text, parsing sentences and updating display
	 */
	public addMessage(text: string): void {
		// Clean text - remove newlines and extra whitespace
		const cleanText = text.trim().replace(/\s+/g, " ");
		if (!cleanText) return;

		// Add to current partial sentence
		this.currentPartialSentence += cleanText;

		// Parse complete sentences
		const completeSentences = this.extractCompleteSentences(
			this.currentPartialSentence,
		);

		if (completeSentences.sentences.length > 0) {
			// Add complete sentences to history
			for (const sentence of completeSentences.sentences) {
				this.sentences.push(sentence);
			}

			// Update partial sentence with remainder
			this.currentPartialSentence = completeSentences.remainder;

			// Update display
			this.updateDisplay();
		} else {
			// No complete sentences yet, just update the current partial one
			this.updateCurrentPartial();
		}
	}

	/**
	 * Extract complete sentences from text, returning sentences and remainder
	 */
	private extractCompleteSentences(text: string): {
		sentences: string[];
		remainder: string;
	} {
		const sentences: string[] = [];
		let remainder = text;

		// Match sentences ending with . ! ? followed by space or end of string
		const sentenceRegex = /([^.!?]*[.!?])(?:\s+|$)/g;
		let match;

		while ((match = sentenceRegex.exec(text)) !== null) {
			const sentence = match[1].trim();
			if (sentence) {
				sentences.push(sentence);
			}
		}

		// Calculate remainder by removing all matched sentences
		if (sentences.length > 0) {
			const lastSentenceEnd =
				text.lastIndexOf(sentences[sentences.length - 1]) +
				sentences[sentences.length - 1].length;
			remainder = text.substring(lastSentenceEnd).trim();
		}

		return { sentences, remainder };
	}

	/**
	 * Update the entire display with current sentence history
	 */
	private updateDisplay(): void {
		// Clear existing text objects
		for (const textObj of this.textLines) {
			textObj.destroy();
		}
		this.textLines.length = 0;

		// Calculate which sentences to show (most recent maxLines)
		const startIndex = Math.max(
			0,
			this.sentences.length - this.options.maxLines,
		);
		const visibleSentences = this.sentences.slice(startIndex);

		// Add partial sentence if we have room and it exists
		const allLines = [...visibleSentences];
		if (
			allLines.length < this.options.maxLines &&
			this.currentPartialSentence
		) {
			allLines.push(this.currentPartialSentence);
		}

		// Create text objects for each line
		for (let i = 0; i < allLines.length; i++) {
			const sentence = allLines[i];
			const isPartial =
				i === allLines.length - 1 && sentence === this.currentPartialSentence;
			const isRecent = i === allLines.length - 1 && !isPartial;

			const style = getFontStyle(this.options.fontKey);
			style.color = Palette.WHITE.hex;
			style.align = "left";

			// Adjust opacity based on recency
			let alpha: number;
			if (isPartial) {
				alpha = 0.7; // Partial sentences are dimmer
			} else if (isRecent) {
				alpha = 1.0; // Most recent complete sentence is brightest
			} else {
				alpha = 0.6; // Older sentences are faded
			}

			const textObj = this.scene.add.text(
				4, // Small left padding
				i * this.lineHeight + 2, // Stack vertically with small top padding
				sentence,
				style,
			);
			textObj.setAlpha(alpha);

			this.add(textObj);
			this.textLines.push(textObj);
		}
	}

	/**
	 * Update just the current partial sentence display
	 */
	private updateCurrentPartial(): void {
		// For streaming updates, just update the last line if it's partial
		if (this.textLines.length === 0) {
			this.updateDisplay();
			return;
		}

		const lastLine = this.textLines[this.textLines.length - 1];
		if (lastLine && this.currentPartialSentence) {
			lastLine.setText(this.currentPartialSentence);
		}
	}

	/**
	 * Clear all messages from the log
	 */
	public clear(): void {
		// Clear all text objects
		for (const textObj of this.textLines) {
			textObj.destroy();
		}
		this.textLines.length = 0;

		// Clear sentence history
		this.sentences.length = 0;
		this.currentPartialSentence = "";
	}

	/**
	 * Hide the log with animation
	 */
	public hide(): void {
		this.scene.tweens.add({
			targets: this,
			alpha: { from: this.alpha, to: 0 },
			duration: 400,
			ease: "Power2.easeOut",
		});
	}

	/**
	 * Show the log with animation
	 */
	public show(): void {
		this.scene.tweens.add({
			targets: this,
			alpha: { from: this.alpha, to: 1 },
			duration: 400,
			ease: "Power2.easeOut",
		});
	}
}
