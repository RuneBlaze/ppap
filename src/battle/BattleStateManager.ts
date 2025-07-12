import { filter, pipe, sort } from "remeda";
import type { BattleCharacter, Skill } from "./types";

export class BattleStateManager {
	// Character data
	private playerParty: BattleCharacter[] = [];
	private enemyParty: BattleCharacter[] = [];
	private turnOrder: BattleCharacter[] = [];
	private turnIndex: number = 0;

	// Battle state
	private isResolvingActions = false;

	// Available skills
	private availableSkills: Skill[] = [
		{
			id: "fire",
			name: "Fire",
			mpCost: 5,
			damage: 25,
			description: "Deals fire damage",
		},
		{
			id: "heal",
			name: "Heal",
			mpCost: 8,
			healing: 30,
			description: "Restores HP",
		},
		{
			id: "thunder",
			name: "Thunder",
			mpCost: 12,
			damage: 40,
			description: "Deals lightning damage",
		},
		{
			id: "cure",
			name: "Cure",
			mpCost: 15,
			healing: 50,
			description: "Restores more HP",
		},
	];

	constructor() {
		this.initializeBattleData();
	}

	// Public accessors
	getPlayerParty(): BattleCharacter[] {
		return this.playerParty;
	}

	getEnemyParty(): BattleCharacter[] {
		return this.enemyParty;
	}

	getTurnOrder(): BattleCharacter[] {
		return this.turnOrder;
	}

	getTurnIndex(): number {
		return this.turnIndex;
	}

	getCurrentCharacter(): BattleCharacter | undefined {
		return this.turnOrder[this.turnIndex];
	}

	getAvailableSkills(): Skill[] {
		return this.availableSkills;
	}

	// =========================================================================
	// State Mutators - These methods apply outcomes to the state
	// =========================================================================

	applyDamage(characterId: string, amount: number) {
		const character = this.findCharacterById(characterId);
		if (character) {
			character.currentHP = Math.max(0, character.currentHP - amount);
			if (character.currentHP === 0) {
				this.applyStatusChange(characterId, "death");
			}
		}
	}

	applyHealing(characterId: string, amount: number) {
		const character = this.findCharacterById(characterId);
		if (character && character.isAlive) {
			character.currentHP = Math.min(
				character.maxHP,
				character.currentHP + amount,
			);
		}
	}

	applyMpCost(characterId: string, amount: number) {
		const character = this.findCharacterById(characterId);
		if (character) {
			character.currentMP = Math.max(0, character.currentMP - amount);
		}
	}

	applyStatusChange(characterId: string, status: "death" | "defend") {
		const character = this.findCharacterById(characterId);
		if (!character) return;

		switch (status) {
			case "death":
				character.isAlive = false;
				break;
			case "defend":
				// Placeholder for defend state logic
				console.log(`${character.name} is defending.`);
				break;
		}
	}

	isCurrentlyResolvingActions(): boolean {
		return this.isResolvingActions;
	}

	setResolvingActions(resolving: boolean): void {
		this.isResolvingActions = resolving;
	}

	// State management methods
	private initializeBattleData(): void {
		// Initialize player party
		this.playerParty = [
			{
				id: "hero",
				name: "Hero",
				level: 10,
				maxHP: 100,
				currentHP: 85,
				maxMP: 50,
				currentMP: 40,
				speed: 15,
				isPlayer: true,
				isAlive: true,
			},
			{
				id: "mage",
				name: "Mage",
				level: 11,
				maxHP: 70,
				currentHP: 65,
				maxMP: 80,
				currentMP: 70,
				speed: 12,
				isPlayer: true,
				isAlive: true,
			},
			{
				id: "rumia",
				name: "Rumia",
				level: 9,
				maxHP: 90,
				currentHP: 90,
				maxMP: 30,
				currentMP: 30,
				speed: 14,
				isPlayer: true,
				isAlive: true,
			},
			{
				id: "momiji",
				name: "Momiji",
				level: 10,
				maxHP: 120,
				currentHP: 110,
				maxMP: 20,
				currentMP: 20,
				speed: 13,
				isPlayer: true,
				isAlive: true,
			},
		];

		// Initialize enemy party
		this.enemyParty = [
			{
				id: "goblin1",
				name: "Goblin",
				level: 5,
				maxHP: 60,
				currentHP: 60,
				maxMP: 20,
				currentMP: 20,
				speed: 10,
				isPlayer: false,
				isAlive: true,
			},
			{
				id: "orc1",
				name: "Orc",
				level: 8,
				maxHP: 120,
				currentHP: 120,
				maxMP: 30,
				currentMP: 30,
				speed: 8,
				isPlayer: false,
				isAlive: true,
			},
		];

		this.recalculateTurnOrder();
	}

	recalculateTurnOrder(): void {
		this.turnOrder = pipe(
			[...this.playerParty, ...this.enemyParty],
			filter((char) => char.isAlive),
			sort((a, b) => b.speed - a.speed),
		);
	}

	advanceTurnIndex(): void {
		this.turnIndex++;
	}

	resetTurnIndex(): void {
		this.turnIndex = 0;
	}

	isCurrentTurnComplete(): boolean {
		return this.turnIndex >= this.turnOrder.length;
	}

	findCharacterById(id: string): BattleCharacter | undefined {
		return [...this.playerParty, ...this.enemyParty].find(
			(char) => char.id === id,
		);
	}

	clearSelectedActions(): void {
		this.turnOrder.forEach((character) => {
			character.selectedAction = undefined;
		});
	}

	checkBattleEnd(): { isEnded: boolean; victory?: boolean } {
		const livingPlayers = filter(this.playerParty, (p) => p.isAlive);
		const livingEnemies = filter(this.enemyParty, (e) => e.isAlive);

		if (livingPlayers.length === 0) {
			return { isEnded: true, victory: false };
		}

		if (livingEnemies.length === 0) {
			return { isEnded: true, victory: true };
		}

		return { isEnded: false };
	}

	startNextTurn(): void {
		this.clearSelectedActions();
		this.setResolvingActions(false);
		this.recalculateTurnOrder();
		this.resetTurnIndex();
	}
}
