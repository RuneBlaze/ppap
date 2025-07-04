// Card definitions for the roguelike deckbuilder

export interface Card {
	id: string;
	name: string;
	description: string;
	artIndex: number; // Index in the card art spritesheet
	rarity: "common" | "uncommon" | "rare" | "legendary";
	effects?: string[];
}

// Example card definitions
export const exampleCards: Card[] = [
	{
		id: "strike",
		name: "Strike",
		description: "Deal 6 damage.",
		artIndex: 0,
		rarity: "common",
	},
	{
		id: "defend",
		name: "Defend",
		description: "Gain 5 Block.",
		artIndex: 1,
		rarity: "common",
	},
	{
		id: "fire_blast",
		name: "Fire Blast",
		description: "Deal 12 damage.",
		artIndex: 2,
		rarity: "uncommon",
	},
	{
		id: "ice_barrier",
		name: "Ice Barrier",
		description: "Gain 8 Block. Draw a card.",
		artIndex: 3,
		rarity: "uncommon",
		effects: ["draw_card"],
	},
	{
		id: "lightning_storm",
		name: "Lightning Storm",
		description: "Deal 8 damage to ALL enemies.",
		artIndex: 4,
		rarity: "rare",
		effects: ["target_all"],
	},
	{
		id: "healing_potion",
		name: "Healing Potion",
		description: "Restore 15 HP.",
		artIndex: 5,
		rarity: "common",
		effects: ["heal_15"],
	},
	{
		id: "power_up",
		name: "Power Up",
		description: "Gain +2 Strength for the rest of combat.",
		artIndex: 6,
		rarity: "uncommon",
		effects: ["gain_strength_2"],
	},
	{
		id: "meteor",
		name: "Meteor",
		description: "Deal 20 damage. Costs 1 less for each card played this turn.",
		artIndex: 7,
		rarity: "legendary",
		effects: ["cost_reduction"],
	},
];

// Utility functions for cards
export function getCardsByRarity(
	cards: Card[],
	rarity: Card["rarity"],
): Card[] {
	return cards.filter((card) => card.rarity === rarity);
}
