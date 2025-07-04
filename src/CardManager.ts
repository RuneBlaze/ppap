import Phaser from "phaser";
import { CardSprite, CardState, type CardZone } from "./CardSprite";
import type { Card } from "./cards";

export class CardManager {
	private scene: Phaser.Scene;
	private cards: CardSprite[] = [];
	private zones: Map<string, CardZone> = new Map();
	private selectedCards: CardSprite[] = [];

	// Grid layout constants (similar to Python version)
	public static readonly GRID_X_START = 50;
	public static readonly GRID_Y_START = 190;
	public static readonly GRID_SPACING_X = 50;
	public static readonly TOTAL_CARDS = 10;

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
		this.setupDefaultZones();
	}

	private setupDefaultZones(): void {
		// Hand zone (bottom of screen)
		this.zones.set("hand", {
			name: "hand",
			bounds: new Phaser.Geom.Rectangle(0, 150, 427, 90),
			cards: [],
			maxCards: 10,
		});

		// Play zone (center of screen)
		this.zones.set("play", {
			name: "play",
			bounds: new Phaser.Geom.Rectangle(100, 80, 227, 60),
			cards: [],
			maxCards: 5,
		});

		// Discard zone (right side)
		this.zones.set("discard", {
			name: "discard",
			bounds: new Phaser.Geom.Rectangle(350, 190, 70, 50),
			cards: [],
			maxCards: undefined, // No limit
		});
	}

	public addCard(card: Card, zoneName: string = "hand"): CardSprite {
		const zone = this.zones.get(zoneName);
		if (!zone) {
			throw new Error(`Zone ${zoneName} does not exist`);
		}

		// Calculate initial position
		const index = zone.cards.length;
		const { x, y } = this.calculateCardPosition(zoneName, index);

		// Create card sprite
		const cardSprite = new CardSprite(this.scene, x, y, card, index);

		// Add to collections
		this.cards.push(cardSprite);
		zone.cards.push(cardSprite);

		// Start with initialize state, then transition to active
		this.scene.time.delayedCall(100 + index * 50, () => {
			cardSprite.transitionTo(CardState.ACTIVE);
		});

		return cardSprite;
	}

	public addCards(cards: Card[], zoneName: string = "hand"): CardSprite[] {
		return cards.map((card) => this.addCard(card, zoneName));
	}

	public removeCard(cardSprite: CardSprite): void {
		// Remove from main collection
		const cardIndex = this.cards.indexOf(cardSprite);
		if (cardIndex >= 0) {
			this.cards.splice(cardIndex, 1);
		}

		// Remove from zone
		for (const zone of this.zones.values()) {
			const zoneIndex = zone.cards.indexOf(cardSprite);
			if (zoneIndex >= 0) {
				zone.cards.splice(zoneIndex, 1);
				this.reorderZone(zone.name);
				break;
			}
		}

		// Remove from selected cards
		this.unselectCard(cardSprite);

		// Destroy the sprite
		cardSprite.destroy();
	}

	public moveCardToZone(cardSprite: CardSprite, targetZoneName: string): void {
		const targetZone = this.zones.get(targetZoneName);
		if (!targetZone) {
			throw new Error(`Zone ${targetZoneName} does not exist`);
		}

		// Remove from current zone
		for (const zone of this.zones.values()) {
			const index = zone.cards.indexOf(cardSprite);
			if (index >= 0) {
				zone.cards.splice(index, 1);
				this.reorderZone(zone.name);
				break;
			}
		}

		// Add to target zone
		targetZone.cards.push(cardSprite);
		const newIndex = targetZone.cards.length - 1;
		const { x, y } = this.calculateCardPosition(targetZoneName, newIndex);

		cardSprite.updatePosition(newIndex, x, y);
	}

	private calculateCardPosition(
		zoneName: string,
		index: number,
	): { x: number; y: number } {
		switch (zoneName) {
			case "hand":
				return this.calculateHandPosition(index);
			case "play":
				return this.calculatePlayPosition(index);
			case "discard":
				return this.calculateDiscardPosition(index);
			default:
				return { x: 0, y: 0 };
		}
	}

	private calculateHandPosition(index: number): { x: number; y: number } {
		const zone = this.zones.get("hand")!;
		const totalCards = zone.cards.length + 1; // +1 for the card being added

		// Fan out effect (similar to Python version)
		const fanOutFactor = Math.sin(Math.abs(index - totalCards / 2) * 0.3) * 20;

		return {
			x: CardManager.GRID_X_START + index * CardManager.GRID_SPACING_X,
			y: CardManager.GRID_Y_START + fanOutFactor,
		};
	}

	private calculatePlayPosition(index: number): { x: number; y: number } {
		const zone = this.zones.get("play")!;
		const spacing = Math.min(
			60,
			zone.bounds.width / Math.max(1, zone.cards.length),
		);
		const startX =
			zone.bounds.x + (zone.bounds.width - zone.cards.length * spacing) / 2;

		return {
			x: startX + index * spacing,
			y: zone.bounds.y + zone.bounds.height / 2 - CardSprite.CARD_HEIGHT / 2,
		};
	}

	private calculateDiscardPosition(index: number): { x: number; y: number } {
		const zone = this.zones.get("discard")!;
		return {
			x: zone.bounds.x,
			y: zone.bounds.y + Math.min(index * 2, 20), // Slight stacking effect
		};
	}

	private reorderZone(zoneName: string): void {
		const zone = this.zones.get(zoneName);
		if (!zone) return;

		zone.cards.forEach((cardSprite, index) => {
			const { x, y } = this.calculateCardPosition(zoneName, index);
			cardSprite.updatePosition(index, x, y);
		});
	}

	public selectCard(cardSprite: CardSprite): void {
		if (!this.selectedCards.includes(cardSprite)) {
			this.selectedCards.push(cardSprite);
			cardSprite.toggleSelection();
		}
	}

	public unselectCard(cardSprite: CardSprite): void {
		const index = this.selectedCards.indexOf(cardSprite);
		if (index >= 0) {
			this.selectedCards.splice(index, 1);
			if (cardSprite.getState() === CardState.ACTIVE) {
				cardSprite.toggleSelection(); // This will unselect it
			}
		}
	}

	public clearSelection(): void {
		this.selectedCards.forEach((cardSprite) => {
			if (cardSprite.getState() === CardState.ACTIVE) {
				cardSprite.toggleSelection();
			}
		});
		this.selectedCards = [];
	}

	public getSelectedCards(): CardSprite[] {
		return [...this.selectedCards];
	}

	public playSelectedCards(): void {
		const cardsToPlay = this.getSelectedCards().filter((card) =>
			card.canTransitionToResolving(),
		);

		if (cardsToPlay.length === 0) return;

		// Move cards to resolving state
		cardsToPlay.forEach((cardSprite, index) => {
			this.scene.time.delayedCall(index * 100, () => {
				cardSprite.transitionTo(CardState.RESOLVING);

				// After a delay, resolve the card
				this.scene.time.delayedCall(1000, () => {
					cardSprite.transitionTo(CardState.RESOLVED);

					// Remove after animation
					this.scene.time.delayedCall(500, () => {
						this.removeCard(cardSprite);
					});
				});
			});
		});

		this.clearSelection();
	}

	public update(time: number, delta: number): void {
		// Update all cards
		this.cards.forEach((card) => {
			if (card.update) {
				card.update(time, delta);
			}
		});
	}

	public getZone(zoneName: string): CardZone | undefined {
		return this.zones.get(zoneName);
	}

	public getAllCards(): CardSprite[] {
		return [...this.cards];
	}

	public getCardsInZone(zoneName: string): CardSprite[] {
		const zone = this.zones.get(zoneName);
		return zone ? [...zone.cards] : [];
	}

	public destroy(): void {
		// Clean up all cards
		this.cards.forEach((card) => card.destroy());
		this.cards = [];
		this.selectedCards = [];
		this.zones.clear();
	}
}
