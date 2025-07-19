import Phaser from "phaser";
import type { ActionDefinition } from "@/battle/types";
import { getFontStyle } from "@/fonts";
import { Palette } from "@/palette";

export interface ActionMenuConfig {
	x: number;
	y: number;
	actions: ActionDefinition[];
	onSelect: (action: ActionDefinition) => void;
}

interface PillButton extends Phaser.GameObjects.Container {
	background: Phaser.GameObjects.Graphics;
	icon: Phaser.GameObjects.Image;
	label: Phaser.GameObjects.Text;
	floatTween?: Phaser.Tweens.Tween;
	action: ActionDefinition;
}

/**
 * ActionMenu - A clean, pill-box style menu for battle action selection.
 * Features vertically-stacked pill buttons with floating animations.
 */
export class ActionMenu extends Phaser.GameObjects.Container {
	private config: ActionMenuConfig;
	private pillButtons: PillButton[] = [];
	private readonly pillHeight = 14;
	private readonly pillSpacing = 3;
	private readonly pillPadding = 4;

	constructor(scene: Phaser.Scene, config: ActionMenuConfig) {
		super(scene, config.x, config.y);

		this.config = { ...config };
		this.createPillButtons();
		this.startFloatingAnimations();

		scene.add.existing(this);
	}

	private createPillButtons(): void {
		this.config.actions.forEach((action, index) => {
			const pill = this.createPillButton(action, index);
			this.pillButtons.push(pill);
			this.add(pill);
		});
	}

	private createPillButton(
		action: ActionDefinition,
		index: number,
	): PillButton {
		const yPos = index * (this.pillHeight + this.pillSpacing);
		const pill = this.scene.add.container(0, yPos) as PillButton;

		// Store action reference
		pill.action = action;

		// Create background graphics
		pill.background = this.scene.add.graphics();
		pill.add(pill.background);

		// Create label text first to calculate width
		pill.label = this.scene.add.text(0, 0, action.name, {
			...getFontStyle("everydayStandard"),
			color: Palette.WHITE.hex,
		});
		pill.label.setOrigin(0, 0.5);

		// Calculate pill width based on text
		const textWidth = pill.label.width;
		const iconSize = 16; // Keep original icon size
		const pillWidth = textWidth + this.pillPadding * 2 + iconSize + 2; // 2px spacing between icon and text

		// Position icon on the left edge of the pill
		pill.icon = this.scene.add.image(
			-pillWidth / 2 + iconSize / 2 + 2,
			0,
			"icons",
			action.iconFrame,
		);
		pill.icon.setOrigin(0.5, 0.5);
		pill.icon.setDisplaySize(iconSize, iconSize);
		pill.add(pill.icon);

		// Position text after the icon
		pill.label.setPosition(-pillWidth / 2 + iconSize + 4, 0);
		pill.add(pill.label);

		// Draw pill background
		this.drawPillBackground(pill.background, pillWidth);

		// Set up interactivity
		pill.setSize(pillWidth, this.pillHeight);
		pill.setInteractive();
		this.setupPillEvents(pill);

		return pill;
	}

	private drawPillBackground(
		graphics: Phaser.GameObjects.Graphics,
		width: number,
	): void {
		graphics.clear();

		// Fill
		graphics.fillStyle(Palette.DARK_CHARCOAL.num, 0.9);
		graphics.fillRoundedRect(
			-width / 2,
			-this.pillHeight / 2,
			width,
			this.pillHeight,
			3, // Much smaller radius for more square look
		);

		// Border
		graphics.lineStyle(1, Palette.GRAY.num, 0.8);
		graphics.strokeRoundedRect(
			-width / 2,
			-this.pillHeight / 2,
			width,
			this.pillHeight,
			3, // Much smaller radius for more square look
		);
	}

	private drawPillBackgroundHover(
		graphics: Phaser.GameObjects.Graphics,
		width: number,
	): void {
		graphics.clear();

		// Highlighted fill
		graphics.fillStyle(Palette.INDIGO.num, 0.8);
		graphics.fillRoundedRect(
			-width / 2,
			-this.pillHeight / 2,
			width,
			this.pillHeight,
			3, // Much smaller radius for more square look
		);

		// Brighter border
		graphics.lineStyle(1, Palette.WHITE.num, 1.0);
		graphics.strokeRoundedRect(
			-width / 2,
			-this.pillHeight / 2,
			width,
			this.pillHeight,
			3, // Much smaller radius for more square look
		);
	}

	private setupPillEvents(pill: PillButton): void {
		const calculatePillWidth = () => {
			const textWidth = pill.label.width;
			const iconSize = 16;
			return textWidth + this.pillPadding * 2 + iconSize + 2;
		};

		pill.on("pointerover", () => {
			// Update background to hover state
			const pillWidth = calculatePillWidth();
			this.drawPillBackgroundHover(pill.background, pillWidth);

			// Brighten icon
			pill.icon.setTint(0xffffcc);

			// Stop floating animation temporarily
			if (pill.floatTween) {
				pill.floatTween.pause();
			}
		});

		pill.on("pointerout", () => {
			// Reset background to normal state
			const pillWidth = calculatePillWidth();
			this.drawPillBackground(pill.background, pillWidth);

			// Reset icon tint
			pill.icon.clearTint();

			// Resume floating animation
			if (pill.floatTween) {
				pill.floatTween.resume();
			}
		});

		pill.on("pointerdown", () => {
			// Visual feedback for press
			pill.setScale(0.95);
		});

		pill.on("pointerup", () => {
			// Reset scale and trigger selection
			pill.setScale(1.0);
			this.config.onSelect(pill.action);
		});
	}

	private startFloatingAnimations(): void {
		this.pillButtons.forEach((pill, index) => {
			// Create continuous floating animation with random offset
			const baseDelay = index * 200; // Stagger start times
			const floatRange = 3;
			const floatSpeed = 2000 + Math.random() * 1000; // Random speed variation

			pill.floatTween = this.scene.tweens.add({
				targets: pill,
				x: {
					from: -floatRange,
					to: floatRange,
				},
				duration: floatSpeed,
				ease: "Sine.easeInOut",
				yoyo: true,
				repeat: -1,
				delay: baseDelay,
			});
		});
	}

	public destroy(fromScene?: boolean): void {
		// Clean up floating animations
		this.pillButtons.forEach((pill) => {
			if (pill.floatTween) {
				pill.floatTween.destroy();
			}
		});
		this.pillButtons = [];

		super.destroy(fromScene);
	}
}
