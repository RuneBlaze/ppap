import { Palette } from "../../palette";
import { TextBlock } from "../primitives/TextBlock";
import { Window } from "../primitives/Window";

export interface QueueEntry {
	characterId: string;
	characterName: string;
	isPlayer: boolean;
	actionName?: string;
	actionIconFrame?: number;
	isRevealed: boolean; // For enemy actions
}

export interface BattleQueueOptions {
	x: number;
	y: number;
	width: number;
	maxVisible: number; // Maximum number of entries to show
}

export class BattleQueue {
	private scene: Phaser.Scene;
	private options: BattleQueueOptions;
	private queue: QueueEntry[] = [];
	private currentIndex = 0;

	// UI Elements
	private window: Window | null = null;
	private entryElements: Array<{
		container: Phaser.GameObjects.Container;
		portrait: Phaser.GameObjects.Image;
		actionIcon: Phaser.GameObjects.Image | null;
		nameText: TextBlock;
		actionText: TextBlock | null;
		background: Phaser.GameObjects.Graphics;
	}> = [];

	constructor(scene: Phaser.Scene, options: BattleQueueOptions) {
		this.scene = scene;
		this.options = options;
	}

	create(): void {
		const height = this.options.maxVisible * 32 + 16; // 32px per entry + padding
		
		this.window = new Window(this.scene, {
			x: this.options.x,
			y: this.options.y,
			width: this.options.width,
			height: height,
			transparent: true,
		});
	}

	setQueue(queue: QueueEntry[]): void {
		this.queue = [...queue];
		this.currentIndex = 0;
		this.refreshDisplay();
	}

	nextEntry(): void {
		if (this.currentIndex < this.queue.length) {
			this.currentIndex++;
			this.animateToNext();
		}
	}

	revealEnemyAction(characterId: string, actionName: string, iconFrame: number): void {
		const entry = this.queue.find(e => e.characterId === characterId && !e.isPlayer);
		if (entry) {
			entry.actionName = actionName;
			entry.actionIconFrame = iconFrame;
			entry.isRevealed = true;
			this.refreshDisplay();
		}
	}

	private refreshDisplay(): void {
		// Clear existing elements
		this.clearEntryElements();

		// Show entries starting from current index
		const startIndex = this.currentIndex;
		const endIndex = Math.min(startIndex + this.options.maxVisible, this.queue.length);

		for (let i = startIndex; i < endIndex; i++) {
			const entry = this.queue[i];
			const displayIndex = i - startIndex;
			this.createEntryElement(entry, displayIndex, i === this.currentIndex);
		}
	}

	private createEntryElement(entry: QueueEntry, displayIndex: number, isActive: boolean): void {
		const entryY = this.options.y + 8 + displayIndex * 32;
		const entryX = this.options.x + 8;

		// Create container for this entry
		const container = this.scene.add.container(entryX, entryY);
		container.setDepth(60);

		// Background highlight for active entry
		const background = this.scene.add.graphics();
		if (isActive) {
			background.fillStyle(Palette.YELLOW.num, 0.3);
			background.fillRoundedRect(0, 0, this.options.width - 16, 28, 4);
			background.lineStyle(1, Palette.YELLOW.num, 0.8);
			background.strokeRoundedRect(0, 0, this.options.width - 16, 28, 4);
		}
		container.add(background);

		// Character portrait (small)
		const portrait = this.scene.add.image(14, 14, "portrait");
		portrait.setDisplaySize(24, 24);
		container.add(portrait);

		// Character name
		const nameText = new TextBlock(this.scene, {
			x: 42,
			y: 8,
			text: entry.characterName,
			fontKey: "everydayStandard",
			color: entry.isPlayer ? Palette.WHITE.hex : Palette.YELLOW.hex,
		});
		nameText.setOrigin(0, 0);
		container.add(nameText);

		// Action display
		let actionIcon: Phaser.GameObjects.Image | null = null;
		let actionText: TextBlock | null = null;

		if (entry.isPlayer || entry.isRevealed) {
			// Show actual action
			if (entry.actionIconFrame !== undefined) {
				actionIcon = this.scene.add.image(42, 20, "icons");
				actionIcon.setFrame(entry.actionIconFrame);
				container.add(actionIcon);
			}

			if (entry.actionName) {
				actionText = new TextBlock(this.scene, {
					x: actionIcon ? 58 : 42,
					y: 20,
					text: entry.actionName,
					fontKey: "everydayStandard",
					color: Palette.GRAY.hex,
				});
				actionText.setOrigin(0, 0.5);
				container.add(actionText);
			}
		} else {
			// Show ??? for unrevealed enemy actions
			actionText = new TextBlock(this.scene, {
				x: 42,
				y: 20,
				text: "???",
				fontKey: "everydayStandard",
				color: Palette.DARK_GRAY.hex,
			});
			actionText.setOrigin(0, 0.5);
			container.add(actionText);
		}

		// Store entry elements
		this.entryElements.push({
			container,
			portrait,
			actionIcon,
			nameText,
			actionText,
			background,
		});

		// Animate entry appearance
		container.setAlpha(0);
		container.setY(entryY + 8);
		this.scene.tweens.add({
			targets: container,
			alpha: { from: 0, to: 1 },
			y: { from: entryY + 8, to: entryY },
			duration: 200,
			delay: displayIndex * 50,
			ease: "Quad.easeOut",
		});
	}

	private animateToNext(): void {
		// Animate current entries sliding up and fading out
		const promises: Promise<void>[] = [];

		this.entryElements.forEach((element) => {
			const promise = new Promise<void>((resolve) => {
				this.scene.tweens.add({
					targets: element.container,
					y: element.container.y - 32,
					alpha: { from: 1, to: 0 },
					duration: 250,
					ease: "Quad.easeIn",
					onComplete: () => resolve(),
				});
			});
			promises.push(promise);
		});

		// After animation completes, refresh display
		Promise.all(promises).then(() => {
			this.refreshDisplay();
		});
	}

	private clearEntryElements(): void {
		this.entryElements.forEach(element => {
			this.scene.tweens.killTweensOf(element.container);
			element.container.destroy();
		});
		this.entryElements = [];
	}

	getCurrentEntry(): QueueEntry | null {
		return this.queue[this.currentIndex] || null;
	}

	isComplete(): boolean {
		return this.currentIndex >= this.queue.length;
	}

	destroy(): void {
		this.clearEntryElements();
		this.window?.destroy();
		this.window = null;
		this.queue = [];
	}
}