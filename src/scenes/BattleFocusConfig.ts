/**
 * Battle Scene Focus State Machine Configuration
 *
 * Defines the states, events, and transitions specific to the battle scene.
 * Each scene can define its own focus management behavior this way.
 */

import type { BattleAction, BattleCharacter } from "../battle/types";
import type { FSMConfig } from "../ui/state/GenericFocusStateMachine";

// =============================================================================
// State Definitions
// =============================================================================
export type BattleFocusState =
	| { id: "idle" }
	| { id: "actionMenu"; character: BattleCharacter };

// =============================================================================
// Event Definitions
// =============================================================================
export type BattleFocusEvent =
	| { type: "startPlayerTurn"; character: BattleCharacter }
	| { type: "selectAttack" }
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
				event: "selectAttack",
				to: () => ({
					id: "idle",
				}),
			},

			// Action confirmed or turn ends -> return to idle
			{
				from: "actionMenu",
				event: "confirmAction",
				to: () => ({ id: "idle" }),
			},
			{
				from: "actionMenu",
				event: "endTurn",
				to: () => ({ id: "idle" }),
			},
		],
	};
