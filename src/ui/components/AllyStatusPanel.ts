import { Palette } from "../../palette";
import { ProgressBar } from "../primitives/ProgressBar";
import { TextBlock } from "../primitives/TextBlock";
import { Window } from "../primitives/Window";

export interface Character {
	id: string;
	name: string;
	level: number;
	maxHP: number;
	currentHP: number;
	maxMP: number;
	currentMP: number;
	isAlive: boolean;
}

export interface AllyStatusPanelOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	characters: Character[];
}

export class AllyStatusPanel {
	private scene: Phaser.Scene;
	private options: AllyStatusPanelOptions;
	private characters: Character[] = [];

	// UI Elements
	private window: Window | null = null;
	private playerPortraits: Phaser.GameObjects.Image[] = [];
	private playerHPBars: ProgressBar[] = [];
	private playerMPBars: ProgressBar[] = [];
	private nameTexts: TextBlock[] = [];
	private levelTexts: TextBlock[] = [];
	private hpLabels: TextBlock[] = [];
	private mpLabels: TextBlock[] = [];
	private actionBadges: Map<string, {
		background: Phaser.GameObjects.Graphics;
		icon: Phaser.GameObjects.Image;
		text: TextBlock;
	}> = new Map();

	// State
	private activeCharacterId: string | null = null;
	private characterWidth = 64; // Fixed width per character

	constructor(scene: Phaser.Scene, options: AllyStatusPanelOptions) {
		this.scene = scene;
		this.options = options;
		this.characters = [...options.characters];
	}

	create(): void {
		// Create the window container
		this.window = new Window(this.scene, {
			x: this.options.x,
			y: this.options.y,
			width: this.options.width,
			height: this.options.height,
		});

		// Create character displays
		this.createCharacterDisplays();
	}

	private createCharacterDisplays(): void {
		this.characters.forEach((character, index) => {
			const sectionX = this.options.x + index * this.characterWidth;

			// Portrait at top (64x64)
			const portraitX = sectionX + 32; // Center in 64px width
			const portraitY = this.options.y + 8 + 32; // 8px from top + half height
			const portrait = this.scene.add.image(portraitX, portraitY, "portrait");
			portrait.setDisplaySize(64, 64);
			this.playerPortraits.push(portrait);

			// Name overlaid on portrait (top)
			const nameText = new TextBlock(this.scene, {
				x: portraitX,
				y: portraitY - 24,
				text: character.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			nameText.setOrigin(0.5, 0.5);
			this.nameTexts.push(nameText);

			// Level overlaid on portrait (top right)
			const levelText = new TextBlock(this.scene, {
				x: portraitX + 24,
				y: portraitY - 24,
				text: `${character.level}`,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			levelText.setOrigin(0.5, 0.5);
			this.levelTexts.push(levelText);

			// HP Bar overlaid on portrait (bottom area)
			const hpBar = new ProgressBar(this.scene, {
				x: portraitX - 28,
				y: portraitY + 16,
				width: 56,
				height: 8,
				value: character.currentHP,
				maxValue: character.maxHP,
				gradientStart: Palette.RED.hex,
				gradientEnd: Palette.RED.hex,
			});
			this.playerHPBars.push(hpBar);

			// MP Bar overlaid on portrait (below HP)
			const mpBar = new ProgressBar(this.scene, {
				x: portraitX - 28,
				y: portraitY + 26,
				width: 56,
				height: 8,
				value: character.currentMP,
				maxValue: character.maxMP,
				gradientStart: Palette.BLUE.hex,
				gradientEnd: Palette.BLUE.hex,
			});
			this.playerMPBars.push(mpBar);

			// HP numeric value overlaid on HP bar
			const hpLabel = new TextBlock(this.scene, {
				x: portraitX,
				y: portraitY + 16,
				text: `${character.currentHP}/${character.maxHP}`,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			hpLabel.setOrigin(0.5, 0.5);
			this.hpLabels.push(hpLabel);

			// MP numeric value overlaid on MP bar
			const mpLabel = new TextBlock(this.scene, {
				x: portraitX,
				y: portraitY + 26,
				text: `${character.currentMP}/${character.maxMP}`,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			mpLabel.setOrigin(0.5, 0.5);
			this.mpLabels.push(mpLabel);
		});
	}

	setCharacters(characters: Character[]): void {
		this.characters = [...characters];
		this.refreshDisplay();
	}

	updateDisplay(): void {
		this.characters.forEach((character, index) => {
			// Update HP bar
			if (this.playerHPBars[index]) {
				this.playerHPBars[index].setValue(character.currentHP, true);
			}

			// Update MP bar
			if (this.playerMPBars[index]) {
				this.playerMPBars[index].setValue(character.currentMP, true);
			}

			// Update name if changed
			if (this.nameTexts[index]) {
				this.nameTexts[index].setText(character.name);
			}

			// Update level if changed
			if (this.levelTexts[index]) {
				this.levelTexts[index].setText(`${character.level}`);
			}

			// Update HP text
			if (this.hpLabels[index]) {
				this.hpLabels[index].setText(
					`${character.currentHP}/${character.maxHP}`,
				);
			}

			// Update MP text
			if (this.mpLabels[index]) {
				this.mpLabels[index].setText(
					`${character.currentMP}/${character.maxMP}`,
				);
			}
		});

		// Update active character highlighting
		this.updateActiveCharacterDisplay();
	}

	setActiveCharacter(characterId: string | null): void {
		this.activeCharacterId = characterId;
		this.updateActiveCharacterDisplay();
	}

	showActionBadge(characterId: string, actionName: string, iconFrame: number): void {
		// Remove existing badge for this character
		this.hideActionBadge(characterId);

		const index = this.characters.findIndex((c) => c.id === characterId);
		if (index === -1) return;

		const sectionX = this.options.x + index * this.characterWidth;
		const portraitX = sectionX + 32; // Center in 64px width
		const portraitY = this.options.y + 8 + 32; // 8px from top + half height

		// Position badge below MP bar with some spacing
		const badgeX = portraitX - 20; // 40px wide badge, centered
		const badgeY = portraitY + 36; // Below MP bar
		const badgeWidth = 40;
		const badgeHeight = 12;

		// Create background rectangle
		const background = this.scene.add.graphics();
		background.setDepth(50);
		
		// Choose color based on action type
		const actionColors = {
			attack: Palette.RED.num,
			defend: Palette.BLUE.num,
			skill: Palette.PURPLE.num,
			item: Palette.GREEN.num,
		};
		
		const actionType = this.getActionTypeFromName(actionName);
		const badgeColor = (actionColors as Record<string, number>)[actionType] || Palette.GRAY.num;
		
		background.fillStyle(badgeColor, 0.8);
		background.fillRoundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2);
		background.lineStyle(1, Palette.WHITE.num, 0.6);
		background.strokeRoundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2);

		// Create action icon (no scaling for pixel perfect)
		const icon = this.scene.add.image(badgeX + 6, badgeY + 6, "icons");
		icon.setFrame(iconFrame);
		icon.setDepth(51);

		// Create abbreviated action text
		const abbreviatedText = this.getAbbreviatedActionName(actionName);
		const text = new TextBlock(this.scene, {
			x: badgeX + 24,
			y: badgeY + 6,
			text: abbreviatedText,
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});
		text.setOrigin(0.5, 0.5);
		text.setDepth(51);

		// Store badge components
		this.actionBadges.set(characterId, { background, icon, text });

		// Animate badge appearance
		background.setAlpha(0);
		icon.setAlpha(0);
		text.setAlpha(0);

		this.scene.tweens.add({
			targets: [background, icon, text],
			alpha: { from: 0, to: 1 },
			duration: 200,
			ease: "Quad.easeOut",
		});
	}

	hideActionBadge(characterId: string): void {
		const badge = this.actionBadges.get(characterId);
		if (badge) {
			// Animate out
			this.scene.tweens.add({
				targets: [badge.background, badge.icon, badge.text],
				alpha: { from: 1, to: 0 },
				duration: 150,
				ease: "Quad.easeIn",
				onComplete: () => {
					badge.background.destroy();
					badge.icon.destroy();
					badge.text.destroy();
					this.actionBadges.delete(characterId);
				}
			});
		}
	}

	private getActionTypeFromName(actionName: string): string {
		const name = actionName.toLowerCase();
		if (name.includes("attack") || name.includes("strike")) return "attack";
		if (name.includes("defend") || name.includes("guard")) return "defend";
		if (name.includes("heal") || name.includes("cure") || name.includes("fire") || name.includes("thunder")) return "skill";
		if (name.includes("potion") || name.includes("item")) return "item";
		return "attack"; // default
	}

	private getAbbreviatedActionName(actionName: string): string {
		// Dynamic abbreviation generation
		const name = actionName.trim();
		
		// For single words <= 4 characters, return as-is
		if (name.length <= 4 && !name.includes(' ')) {
			return name.toUpperCase();
		}
		
		// For multi-word actions, take first letter of each word
		const words = name.split(' ');
		if (words.length > 1) {
			const initials = words.map(word => word.charAt(0)).join('');
			return initials.length <= 4 ? initials.toUpperCase() : initials.substring(0, 4).toUpperCase();
		}
		
		// For single long words, take first 4 characters
		return name.substring(0, 4).toUpperCase();
	}

	private updateActiveCharacterDisplay(): void {
		const activeIndex = this.activeCharacterId
			? this.characters.findIndex((c) => c.id === this.activeCharacterId)
			: -1;

		this.playerPortraits.forEach((portrait, index) => {
			if (index === activeIndex) {
				// Active player - animate to full opacity (no scaling for pixel perfect)
				this.scene.tweens.add({
					targets: portrait,
					alpha: { from: portrait.alpha, to: 1.0 },
					duration: 200,
					ease: "Quad.easeOut",
				});

				// Add subtle pulsing effect for active character
				this.scene.tweens.add({
					targets: portrait,
					alpha: { from: 1.0, to: 0.85 },
					duration: 800,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				});
			} else {
				// Inactive players - animate to reduced opacity
				this.scene.tweens.killTweensOf(portrait); // Stop any existing animations
				this.scene.tweens.add({
					targets: portrait,
					alpha: { from: portrait.alpha, to: 0.4 },
					duration: 200,
					ease: "Quad.easeOut",
				});
			}
		});

		// Also animate corresponding name/level text elements (no scaling for pixel perfect)
		this.nameTexts.forEach((nameText, index) => {
			if (index === activeIndex) {
				this.scene.tweens.add({
					targets: nameText,
					alpha: { from: nameText.alpha, to: 1.0 },
					duration: 200,
					ease: "Quad.easeOut",
				});
			} else {
				this.scene.tweens.killTweensOf(nameText);
				this.scene.tweens.add({
					targets: nameText,
					alpha: { from: nameText.alpha, to: 0.6 },
					duration: 200,
					ease: "Quad.easeOut",
				});
			}
		});

		this.levelTexts.forEach((levelText, index) => {
			if (index === activeIndex) {
				this.scene.tweens.add({
					targets: levelText,
					alpha: { from: levelText.alpha, to: 1.0 },
					duration: 200,
					ease: "Quad.easeOut",
				});
			} else {
				this.scene.tweens.killTweensOf(levelText);
				this.scene.tweens.add({
					targets: levelText,
					alpha: { from: levelText.alpha, to: 0.6 },
					duration: 200,
					ease: "Quad.easeOut",
				});
			}
		});
	}

	private refreshDisplay(): void {
		// Clear existing displays
		this.destroyDisplayElements();

		// Recreate displays with new data
		this.createCharacterDisplays();

		// Restore active character highlighting
		this.updateActiveCharacterDisplay();
	}

	private destroyDisplayElements(): void {
		// Kill any active tweens before destroying elements
		this.playerPortraits.forEach((portrait) => {
			this.scene.tweens.killTweensOf(portrait);
			portrait.destroy();
		});
		this.playerHPBars.forEach((bar) => bar.destroy());
		this.playerMPBars.forEach((bar) => bar.destroy());
		this.nameTexts.forEach((text) => {
			this.scene.tweens.killTweensOf(text);
			text.destroy();
		});
		this.levelTexts.forEach((text) => {
			this.scene.tweens.killTweensOf(text);
			text.destroy();
		});
		this.hpLabels.forEach((label) => label.destroy());
		this.mpLabels.forEach((label) => label.destroy());

		// Clean up action badges
		this.actionBadges.forEach((badge) => {
			this.scene.tweens.killTweensOf([badge.background, badge.icon, badge.text]);
			badge.background.destroy();
			badge.icon.destroy();
			badge.text.destroy();
		});

		this.playerPortraits = [];
		this.playerHPBars = [];
		this.playerMPBars = [];
		this.nameTexts = [];
		this.levelTexts = [];
		this.hpLabels = [];
		this.mpLabels = [];
		this.actionBadges.clear();
	}

	getCharacterAtIndex(index: number): Character | null {
		return this.characters[index] || null;
	}

	getCharacterById(id: string): Character | null {
		return this.characters.find((c) => c.id === id) || null;
	}

	getActiveCharacter(): Character | null {
		return this.activeCharacterId
			? this.getCharacterById(this.activeCharacterId)
			: null;
	}

	getBounds(): Phaser.Geom.Rectangle {
		return new Phaser.Geom.Rectangle(
			this.options.x,
			this.options.y,
			this.options.width,
			this.options.height,
		);
	}

	getCharacterSectionBounds(characterId: string): Phaser.Geom.Rectangle | null {
		const index = this.characters.findIndex((c) => c.id === characterId);
		if (index === -1) return null;

		const sectionX = this.options.x + index * this.characterWidth;
		return new Phaser.Geom.Rectangle(
			sectionX,
			this.options.y,
			this.characterWidth,
			this.options.height,
		);
	}

	destroy(): void {
		this.destroyDisplayElements();
		this.window?.destroy();
		this.window = null;
		this.characters = [];
		this.activeCharacterId = null;
	}
}
