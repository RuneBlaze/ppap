import { pipe, sort } from "remeda";
import { match } from "ts-pattern";
import {
	ActionType,
	type BattleAction,
	type BattleCharacter,
	type Skill,
} from "./BattleScene";

/**
 * Represents the outcome of a single action resolution.
 * The scene uses this data to play animations and update the UI.
 */
export interface ResolutionStep {
	source: BattleCharacter;
	action: BattleAction;
	target?: BattleCharacter;
	damage?: number;
	healing?: number;
}

export class BattleResolver {
	public readonly resolutionQueue: readonly BattleCharacter[];
	private readonly allCharacters: BattleCharacter[];
	private readonly availableSkills: Skill[];

	constructor(turnOrder: BattleCharacter[], availableSkills: Skill[]) {
		this.allCharacters = [...turnOrder];
		this.availableSkills = availableSkills;

		// Create a sanitized and sorted queue for resolution.
		const uniqueCharacters = turnOrder.filter(
			(char, index, array) =>
				char.isAlive &&
				char.selectedAction &&
				array.findIndex((c) => c.id === char.id) === index,
		);

		this.resolutionQueue = pipe(
			uniqueCharacters,
			sort((a, b) => b.speed - a.speed),
		);
	}

	/**
	 * Async generator that yields the result of each action resolution.
	 * The `for await...of` loop in the scene will handle the delay between steps.
	 */
	public async *[Symbol.asyncIterator](): AsyncGenerator<ResolutionStep> {
		for (const character of this.resolutionQueue) {
			// Skip this character if they were defeated by a faster character this turn
			if (!character.isAlive) {
				continue;
			}

			// This check is technically redundant due to constructor filtering, but safe.
			if (!character.selectedAction) continue;

			const step = this.executeAction(character, character.selectedAction);

			yield step;
		}
	}

	private executeAction(
		character: BattleCharacter,
		action: BattleAction,
	): ResolutionStep {
		console.log(
			`[RESOLVER] ${character.name} (${character.id}) performs ${action.type}`,
		);

		const target = this.findCharacterById(action.targetId);
		const step: ResolutionStep = { source: character, action, target };

		match(action.type)
			.with(ActionType.ATTACK, () => {
				const damage = Math.floor(Math.random() * 30) + 10;
				if (target) {
					this.applyDamage(target, damage);
					step.damage = damage;
				}
			})
			.with(ActionType.DEFEND, () => {
				// Defend logic can be added here. For now, it's a no-op.
				console.log(`${character.name} defends!`);
			})
			.with(ActionType.SKILL, () => {
				const skill = this.availableSkills.find((s) => s.id === action.skillId);
				if (!skill) return;

				character.currentMP = Math.max(0, character.currentMP - skill.mpCost);

				if (target) {
					if (skill.damage) {
						this.applyDamage(target, skill.damage);
						step.damage = skill.damage;
					} else if (skill.healing) {
						this.applyHealing(target, skill.healing);
						step.healing = skill.healing;
					}
				}
			})
			.with(ActionType.ITEM, () => {
				console.log(`${character.name} uses an item!`);
			})
			.exhaustive();

		return step;
	}

	private findCharacterById(id?: string): BattleCharacter | undefined {
		if (!id) return undefined;
		return this.allCharacters.find((c) => c.id === id);
	}

	private applyDamage(character: BattleCharacter, damage: number) {
		character.currentHP = Math.max(0, character.currentHP - damage);
		if (character.currentHP <= 0) {
			character.isAlive = false;
		}
	}

	private applyHealing(character: BattleCharacter, healing: number) {
		character.currentHP = Math.min(
			character.maxHP,
			character.currentHP + healing,
		);
	}
}
