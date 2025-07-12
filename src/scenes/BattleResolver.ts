import { pipe, sort } from "remeda";
import {
	ActionType,
	type BattleAction,
	type BattleCharacter,
	type Skill,
} from "./BattleScene";

/**
 * Base interface for all battle outcome events
 */
export interface BaseBattleOutcome {
	type: string;
}

/**
 * Event when an action starts executing
 */
export interface ActionStartOutcome extends BaseBattleOutcome {
	type: "action_start";
	sourceId: string;
	actionType: ActionType;
}

/**
 * Event when damage is dealt to a character
 */
export interface DamageOutcome extends BaseBattleOutcome {
	type: "damage";
	targetId: string;
	amount: number;
	isCrit: boolean;
}

/**
 * Event when healing is applied to a character
 */
export interface HealOutcome extends BaseBattleOutcome {
	type: "heal";
	targetId: string;
	amount: number;
}

/**
 * Event when MP is consumed for a skill
 */
export interface MpCostOutcome extends BaseBattleOutcome {
	type: "mp_cost";
	sourceId: string;
	amount: number;
}

/**
 * Event when a character's status changes (death, etc.)
 */
export interface StatusChangeOutcome extends BaseBattleOutcome {
	type: "status_change";
	targetId: string;
	status: "death" | "defend";
}

/**
 * Event when an action completes
 */
export interface ActionCompleteOutcome extends BaseBattleOutcome {
	type: "action_complete";
	sourceId: string;
}

/**
 * Union type of all possible battle outcomes
 */
export type BattleOutcome =
	| ActionStartOutcome
	| DamageOutcome
	| HealOutcome
	| MpCostOutcome
	| StatusChangeOutcome
	| ActionCompleteOutcome;

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
	 * New async generator that yields specific outcome events for each action resolution.
	 * This replaces the monolithic ResolutionStep with granular events.
	 */
	public async *resolveActionsAsOutcomes(): AsyncGenerator<BattleOutcome> {
		for (const character of this.resolutionQueue) {
			// Skip this character if they were defeated by a faster character this turn
			if (!character.isAlive) {
				continue;
			}

			// This check is technically redundant due to constructor filtering, but safe.
			if (!character.selectedAction) continue;

			// Yield all outcomes for this character's action
			yield* this.executeActionAsOutcomes(character, character.selectedAction);
		}
	}

	/**
	 * New method that executes an action and yields granular outcome events
	 */
	private *executeActionAsOutcomes(
		character: BattleCharacter,
		action: BattleAction,
	): Generator<BattleOutcome> {
		console.log(
			`[RESOLVER] ${character.name} (${character.id}) performs ${action.type}`,
		);

		// Start of action
		yield {
			type: "action_start",
			sourceId: character.id,
			actionType: action.type,
		};

		const target = this.findCharacterById(action.targetId);

		// Handle different action types with explicit if-else to support yield
		if (action.type === ActionType.ATTACK) {
			const damage = Math.floor(Math.random() * 30) + 10;
			const isCrit = Math.random() < 0.1; // 10% crit chance

			if (target) {
				const wasAlive = target.isAlive;
				this.applyDamage(target, damage);

				// Emit damage event
				yield {
					type: "damage",
					targetId: target.id,
					amount: damage,
					isCrit,
				};

				// Check if target died
				if (wasAlive && !target.isAlive) {
					yield {
						type: "status_change",
						targetId: target.id,
						status: "death",
					};
				}
			}
		} else if (action.type === ActionType.DEFEND) {
			console.log(`${character.name} defends!`);

			// Emit defend status
			yield {
				type: "status_change",
				targetId: character.id,
				status: "defend",
			};
		} else if (action.type === ActionType.SKILL) {
			const skill = this.availableSkills.find((s) => s.id === action.skillId);
			if (skill) {
				// Emit MP cost event
				if (skill.mpCost > 0) {
					yield {
						type: "mp_cost",
						sourceId: character.id,
						amount: skill.mpCost,
					};
				}

				character.currentMP = Math.max(0, character.currentMP - skill.mpCost);

				if (target) {
					if (skill.damage) {
						const wasAlive = target.isAlive;
						this.applyDamage(target, skill.damage);

						// Emit damage event
						yield {
							type: "damage",
							targetId: target.id,
							amount: skill.damage,
							isCrit: false, // Skills don't crit for now
						};

						// Check if target died
						if (wasAlive && !target.isAlive) {
							yield {
								type: "status_change",
								targetId: target.id,
								status: "death",
							};
						}
					} else if (skill.healing) {
						this.applyHealing(target, skill.healing);

						// Emit healing event
						yield {
							type: "heal",
							targetId: target.id,
							amount: skill.healing,
						};
					}
				}
			}
		} else if (action.type === ActionType.ITEM) {
			console.log(`${character.name} uses an item!`);
			// Items could have their own outcome events in the future
		}

		// End of action
		yield {
			type: "action_complete",
			sourceId: character.id,
		};
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
