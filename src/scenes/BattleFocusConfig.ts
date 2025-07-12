/**
 * Battle Scene Focus State Machine Configuration
 *
 * Defines the states, events, and transitions specific to the battle scene.
 * Each scene can define its own focus management behavior this way.
 */

import type { FSMConfig } from "../ui/state/GenericFocusStateMachine";
import {
	ActionType,
	type BattleAction,
	type BattleCharacter,
	type Skill,
} from "./BattleScene";

// =============================================================================
// State Definitions
// =============================================================================
export type BattleFocusState =
	| { id: "idle" }
	| { id: "actionMenu"; character: BattleCharacter }
	| { id: "skillMenu"; character: BattleCharacter; skills: Skill[] }
	| {
			id: "targetMenu";
			character: BattleCharacter;
			pendingAction: Partial<BattleAction>;
			targets: BattleCharacter[];
	  }
	| { id: "itemMenu"; character: BattleCharacter };

// =============================================================================
// Event Definitions
// =============================================================================
export type BattleFocusEvent =
	| { type: "startPlayerTurn"; character: BattleCharacter }
	| { type: "selectAttack" }
	| { type: "selectSkill"; skills: Skill[] }
	| { type: "selectItem" }
	| { type: "selectTarget"; targetId: string }
	| { type: "back" }
	| { type: "cancel" }
	| { type: "confirmAction"; action: BattleAction }
	| { type: "endTurn" };

/**
 * Battle Scene FSM Configuration
 *
 * This completely defines the battle scene's focus behavior.
 * Other scenes would create their own similar configurations.
 */
export const battleFocusConfig: FSMConfig<BattleFocusState, BattleFocusEvent> =
	{
		initialState: { id: "idle" },

		transitions: [
			// Starting player turn -> show action menu for that character
			{
				from: "idle",
				event: "startPlayerTurn",
				to: (event) => ({
					id: "actionMenu",
					character: (event as BattleFocusEvent & { type: "startPlayerTurn" })
						.character,
				}),
			},

			// From action menu
			{
				from: "actionMenu",
				event: "selectSkill",
				to: (event, fromState) => ({
					id: "skillMenu",
					character: (fromState as any).character,
					skills: (event as any).skills,
				}),
			},
			{
				from: "actionMenu",
				event: "selectAttack",
				to: (_event, fromState) => ({
					id: "targetMenu",
					character: (fromState as any).character,
					pendingAction: { type: ActionType.ATTACK },
					targets: [], // This will be populated by the scene
				}),
			},
			{
				from: "actionMenu",
				event: "selectItem",
				to: (_event, fromState) => ({
					id: "itemMenu",
					character: (fromState as any).character,
				}),
			},

			// From skill menu
			{
				from: "skillMenu",
				event: "selectAttack", // A skill was chosen, now select a target
				to: (_event, fromState) => ({
					id: "targetMenu",
					character: (fromState as any).character,
					pendingAction: {
						type: ActionType.SKILL,
						skillId: (event as any).skillId,
					},
					targets: [], // This will be populated by the scene
				}),
			},
			{
				from: "skillMenu",
				event: "back",
				to: (_event, fromState) => ({
					id: "actionMenu",
					character: (fromState as any).character,
				}),
			},

			// From target menu
			{
				from: "targetMenu",
				event: "back",
				// This is where a parameterized state shines. We can return to the
				// correct previous menu (action or skill) based on the pending action.
				to: (_event, fromState) => {
					const { character, pendingAction } = fromState as any;
					if (pendingAction.type === "skill") {
						// We need to know the available skills to go back.
						// This highlights a need to maybe pass more data around,
						// or have the scene provide it when the state is entered.
						return { id: "skillMenu", character, skills: [] };
					}
					return { id: "actionMenu", character };
				},
			},
			{
				from: "targetMenu",
				event: "selectTarget",
				to: (_event, _fromState) => {
					// The action is now fully defined.
					// We could transition to a "confirming" state, but for now
					// let's just go back to idle as the action is executed.
					return { id: "idle" };
				},
			},

			// From item menu
			{
				from: "itemMenu",
				event: "back",
				to: (_event, fromState) => ({
					id: "actionMenu",
					character: (fromState as any).character,
				}),
			},

			// Cancelling returns to the action menu (or idle if nothing is happening)
			{
				from: ["skillMenu", "targetMenu", "itemMenu"],
				event: "cancel",
				to: (_event, fromState) => ({
					id: "actionMenu",
					character: (fromState as any).character,
				}),
			},

			// Action confirmed or turn ends -> return to idle
			{
				from: ["actionMenu", "targetMenu", "itemMenu", "skillMenu"],
				event: "confirmAction",
				to: () => ({ id: "idle" }),
			},
			{
				from: ["actionMenu", "skillMenu", "targetMenu", "itemMenu"],
				event: "endTurn",
				to: () => ({ id: "idle" }),
			},
		],
	};
