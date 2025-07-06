import { ProgressBar } from "../primitives/ProgressBar";
import { TextBlock } from "../primitives/TextBlock";
import { Window } from "../primitives/Window";
import { Palette } from "../../palette";

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

			// Name below portrait
			const nameText = new TextBlock(this.scene, {
				x: sectionX + 2,
				y: this.options.y + 8 + 64 + 2,
				text: character.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			this.nameTexts.push(nameText);

			// Level below name
			const levelText = new TextBlock(this.scene, {
				x: sectionX + 2,
				y: this.options.y + 8 + 64 + 14,
				text: `Lv ${character.level}`,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			this.levelTexts.push(levelText);

			// HP Bar below name/level
			const hpBarY = this.options.y + 8 + 64 + 26;
			const hpBar = new ProgressBar(this.scene, {
				x: sectionX + 2,
				y: hpBarY,
				width: 60,
				height: 6,
				value: character.currentHP,
				maxValue: character.maxHP,
				gradientStart: Palette.RED.hex,
				gradientEnd: Palette.RED.hex,
			});
			this.playerHPBars.push(hpBar);

			// MP Bar below HP bar
			const mpBarY = hpBarY + 8;
			const mpBar = new ProgressBar(this.scene, {
				x: sectionX + 2,
				y: mpBarY,
				width: 60,
				height: 6,
				value: character.currentMP,
				maxValue: character.maxMP,
				gradientStart: Palette.BLUE.hex,
				gradientEnd: Palette.BLUE.hex,
			});
			this.playerMPBars.push(mpBar);

			// HP label
			const hpLabel = new TextBlock(this.scene, {
				x: sectionX + 2,
				y: hpBarY - 10,
				text: "HP",
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
			this.hpLabels.push(hpLabel);

			// MP label
			const mpLabel = new TextBlock(this.scene, {
				x: sectionX + 32,
				y: hpBarY - 10,
				text: "MP",
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});
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
				this.levelTexts[index].setText(`Lv ${character.level}`);
			}
		});

		// Update active character highlighting
		this.updateActiveCharacterDisplay();
	}

	setActiveCharacter(characterId: string | null): void {
		this.activeCharacterId = characterId;
		this.updateActiveCharacterDisplay();
	}

	private updateActiveCharacterDisplay(): void {
		const activeIndex = this.activeCharacterId 
			? this.characters.findIndex(c => c.id === this.activeCharacterId)
			: -1;

		this.playerPortraits.forEach((portrait, index) => {
			if (index === activeIndex) {
				// Active player - full opacity
				portrait.setAlpha(1.0);
			} else {
				// Inactive players - reduced opacity
				portrait.setAlpha(0.4);
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
		this.playerPortraits.forEach(portrait => portrait.destroy());
		this.playerHPBars.forEach(bar => bar.destroy());
		this.playerMPBars.forEach(bar => bar.destroy());
		this.nameTexts.forEach(text => text.destroy());
		this.levelTexts.forEach(text => text.destroy());
		this.hpLabels.forEach(label => label.destroy());
		this.mpLabels.forEach(label => label.destroy());

		this.playerPortraits = [];
		this.playerHPBars = [];
		this.playerMPBars = [];
		this.nameTexts = [];
		this.levelTexts = [];
		this.hpLabels = [];
		this.mpLabels = [];
	}

	getCharacterAtIndex(index: number): Character | null {
		return this.characters[index] || null;
	}

	getCharacterById(id: string): Character | null {
		return this.characters.find(c => c.id === id) || null;
	}

	getActiveCharacter(): Character | null {
		return this.activeCharacterId ? this.getCharacterById(this.activeCharacterId) : null;
	}

	getBounds(): Phaser.Geom.Rectangle {
		return new Phaser.Geom.Rectangle(
			this.options.x,
			this.options.y,
			this.options.width,
			this.options.height
		);
	}

	getCharacterSectionBounds(characterId: string): Phaser.Geom.Rectangle | null {
		const index = this.characters.findIndex(c => c.id === characterId);
		if (index === -1) return null;

		const sectionX = this.options.x + index * this.characterWidth;
		return new Phaser.Geom.Rectangle(
			sectionX,
			this.options.y,
			this.characterWidth,
			this.options.height
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