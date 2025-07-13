import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { hasToolCall, streamText, tool } from "ai";
import { Eta } from "eta";
import { XMLParser } from "fast-xml-parser";
import { pipe, sort } from "remeda";
import { z } from "zod";
import {
	ActionType,
	type BattleAction,
	type BattleCharacter,
	type Skill,
} from "../battle/types";
import { diceRollTool } from "../dice";

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

/**
 * Interface for XML battle actions
 */
interface XMLStatAction {
	type: "mp_heal" | "mp_cost" | "mp_damage" | "hp_damage" | "hp_heal";
	targetId: string;
	amount: number;
}

interface XMLStatusAction {
	type: "status_change";
	targetId: string;
	status: "death" | "defend"; // Use the same status types as StatusChangeOutcome
}

type XMLBattleAction = XMLStatAction | XMLStatusAction;

/**
 * Template for generating action descriptions
 */
const ACTION_TEMPLATE = `<% if (it.actionType === 'ATTACK') { %>
<%= it.characterName %> attacks <%= it.targetName %>.
<% } else if (it.actionType === 'SKILL') { %>
<%= it.characterName %> uses skill '<%= it.skillName %>' on <%= it.targetName %>.
<% } else if (it.actionType === 'DEFEND') { %>
<%= it.characterName %> takes a defensive stance.
<% } else if (it.actionType === 'ITEM') { %>
<%= it.characterName %> uses an item on <%= it.targetName %>.
<% } else { %>
Resolve <%= it.characterName %>'s action.
<% } %>`;

/**
 * Template for generating character context
 */
const CHARACTER_CONTEXT_TEMPLATE = `<% it.characters.forEach(function(c) { %>
- <%= c.name %> (id: <%= c.id %>, hp: <%= c.currentHP %>/<%= c.maxHP %>, mp: <%= c.currentMP %>/<%= c.maxMP %>, speed: <%= c.speed %>, isAlive: <%= c.isAlive %>)
<% }); %>`;

/**
 * Template for the system prompt
 */
const SYSTEM_PROMPT_TEMPLATE = `You are the Game Master (GM) for a fantasy RPG battle. Your role is to narrate the action and determine the outcome of each character's chosen intent for the turn. You will be given a list of actions to resolve.

Your Core Directives:

1.  **Follow the Order:** Process the actions in the list you are given, sequentially from top to bottom.
2.  **Interpret Intent:** Your first step for each action is to understand the character's intent (e.g., "Hero attacks Slime").
3.  **Determine Outcome with Dice:** Use the \`dice\` tool to add randomness and determine success or failure, damage, or other effects. Be creative but fair. For a standard attack, you might roll \`1d20\` to hit, and \`2d6\` for damage.
4.  **Translate to Concrete Effects:** Based on the intent and dice rolls, translate the action into one or more concrete effects using the \`battleAction\` tool. This is how you make things happen in the game. For example, a successful hit becomes \`<hp_damage targetId="some-enemy">25</hp_damage>\`. A "defend" action becomes \`<status_change targetId="char-id" status="defend" />\`.
5.  **Signal Completion:** Once all actions in the list have been resolved, you MUST call the \`qed\` tool to signify the end of the turn resolution.

Important Context: You will be provided with the current state of all characters in the battle, including their IDs (for \`targetId\`), stats, etc. Use this information to inform your dice rolls and \`battleAction\` calls.`;

/**
 * Template for the main prompt
 */
const MAIN_PROMPT_TEMPLATE = `The turn begins. Here is the current state of the battlefield:

<%= it.characterContext %>

Here are the actions you must resolve, in order:
<% it.actionTodos.forEach(function(todo, i) { %>
<%= i + 1 %>. <%= todo %>
<% }); %>

Please begin resolving the actions. Call the 'qed' tool when you have resolved all of them.`;

export class BattleResolver {
	public readonly resolutionQueue: readonly BattleCharacter[];
	private readonly availableSkills: Skill[];
	private readonly xmlParser: XMLParser;
	private readonly eta: Eta;

	constructor(turnOrder: BattleCharacter[], availableSkills: Skill[]) {
		this.availableSkills = availableSkills;
		this.eta = new Eta();

		// Initialize XML parser
		this.xmlParser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			parseAttributeValue: true,
			parseTagValue: true,
			ignoreDeclaration: true,
			ignorePiTags: true,
			trimValues: true,
		});

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
	 * Stateless async generator that yields specific outcome events for each action resolution.
	 * Takes the initial character state and calculates outcomes without mutating state.
	 */
	public async *resolveActionsAsOutcomes(
		initialCharacters: BattleCharacter[],
	): AsyncGenerator<BattleOutcome> {
		const battleActionTool = this.createBattleActionTool(initialCharacters);
		const qedTool = this.createQedTool();

		const systemPrompt = this.buildSystemPrompt();
		const mainPrompt = this.buildMainPrompt(initialCharacters);

		const google = createGoogleGenerativeAI({
			apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
		});
		const result = await streamText({
			model: google("gemini-2.5-flash-preview-05-20"),
			system: systemPrompt,
			prompt: mainPrompt,
			tools: {
				battleAction: battleActionTool,
				dice: diceRollTool,
				qed: qedTool,
			},
			stopWhen: hasToolCall("qed"),
		});

		for await (const part of result.fullStream) {
			if (part.type === "tool-result" && part.toolName === "battleAction") {
				const toolOutput = part.output as {
					success: boolean;
					outcomes: BattleOutcome[];
				};
				if (toolOutput.success && toolOutput.outcomes) {
					for (const outcome of toolOutput.outcomes) {
						yield outcome;
					}
				}
			} else if (part.type === "text") {
				console.log(`[GM]: ${part.text}`);
			}
		}
	}

	/**
	 * Stateless method that executes an action and yields granular outcome events
	 */
	private *executeActionAsOutcomes(
		character: BattleCharacter,
		action: BattleAction,
		allCharacters: BattleCharacter[],
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

		const target = this.findCharacterById(action.targetId, allCharacters);

		// Handle different action types with explicit if-else to support yield
		if (action.type === ActionType.ATTACK) {
			const damage = Math.floor(Math.random() * 30) + 10;
			const isCrit = Math.random() < 0.1; // 10% crit chance

			if (target) {
				// Emit damage event
				yield {
					type: "damage",
					targetId: target.id,
					amount: damage,
					isCrit,
				};

				// Check if target would die (calculate death based on initial state)
				const wouldDie = target.isAlive && target.currentHP - damage <= 0;
				if (wouldDie) {
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

				if (target) {
					if (skill.damage) {
						// Emit damage event
						yield {
							type: "damage",
							targetId: target.id,
							amount: skill.damage,
							isCrit: false, // Skills don't crit for now
						};

						// Check if target would die (calculate death based on initial state)
						const wouldDie =
							target.isAlive && target.currentHP - skill.damage <= 0;
						if (wouldDie) {
							yield {
								type: "status_change",
								targetId: target.id,
								status: "death",
							};
						}
					} else if (skill.healing) {
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

	/**
	 * Parse XML battle actions and validate targets
	 */
	private parseXMLBattleActions(xmlString: string): XMLBattleAction[] {
		try {
			// Wrap the XML string in a root element to handle multiple actions
			const wrappedXml = `<actions>${xmlString}</actions>`;
			const parsed = this.xmlParser.parse(wrappedXml);

			if (!parsed.actions) {
				throw new Error("No valid actions found in XML");
			}

			const actions: XMLBattleAction[] = [];
			const actionTypes = [
				"mp_heal",
				"mp_cost",
				"mp_damage",
				"hp_damage",
				"hp_heal",
				"status_change",
			];

			for (const actionType of actionTypes) {
				const actionData = parsed.actions[actionType];
				if (actionData) {
					// Handle both single action and array of actions
					const actionArray = Array.isArray(actionData)
						? actionData
						: [actionData];

					for (const action of actionArray) {
						if (actionType === "status_change") {
							const targetId = action["@_targetId"];
							const status = action["@_status"];
							if (!targetId || typeof targetId !== "string") {
								throw new Error(
									"Invalid or missing targetId for status_change",
								);
							}
							if (status !== "death" && status !== "defend") {
								throw new Error(`Invalid status "${status}" for status_change`);
							}
							actions.push({
								type: "status_change",
								targetId,
								status,
							});
							continue;
						}

						let targetId: string;
						let amount: number;

						// Handle different XML structures
						if (typeof action === "object" && action["@_targetId"]) {
							targetId = action["@_targetId"];
							amount =
								typeof action === "object" && action["#text"]
									? parseFloat(action["#text"])
									: parseFloat(action);
						} else if (typeof action === "string") {
							throw new Error(`Missing targetId attribute for ${actionType}`);
						} else {
							throw new Error(`Invalid structure for ${actionType}`);
						}

						// Validate targetId
						if (!targetId || typeof targetId !== "string") {
							throw new Error(`Invalid or missing targetId for ${actionType}`);
						}

						// Note: Target validation will be done when the method is called with actual character data

						// Validate amount
						if (isNaN(amount) || amount < 0) {
							throw new Error(`Invalid amount '${amount}' for ${actionType}`);
						}

						actions.push({
							type: actionType as XMLStatAction["type"],
							targetId,
							amount: Math.floor(amount),
						});
					}
				}
			}

			return actions;
		} catch (error) {
			throw new Error(
				`XML parsing failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Execute XML battle actions and yield outcomes (stateless)
	 */
	private *executeXMLActionsAsOutcomes(
		actions: XMLBattleAction[],
		allCharacters: BattleCharacter[],
	): Generator<BattleOutcome> {
		for (const action of actions) {
			const target = this.findCharacterById(action.targetId, allCharacters);
			if (!target) continue; // Should not happen due to validation, but safety check

			console.log(
				`[XML ACTION] ${action.type} on ${target.name} for ${"amount" in action ? action.amount : action.status}`,
			);

			switch (action.type) {
				case "hp_damage": {
					yield {
						type: "damage",
						targetId: target.id,
						amount: action.amount,
						isCrit: false,
					};

					// Check if target would die (calculate death based on initial state)
					const wouldDie =
						target.isAlive && target.currentHP - action.amount <= 0;
					if (wouldDie) {
						yield {
							type: "status_change",
							targetId: target.id,
							status: "death",
						};
					}
					break;
				}

				case "hp_heal": {
					yield {
						type: "heal",
						targetId: target.id,
						amount: action.amount,
					};
					break;
				}

				case "mp_cost": {
					yield {
						type: "mp_cost",
						sourceId: target.id,
						amount: action.amount,
					};
					break;
				}

				case "mp_heal": {
					// Calculate actual healing based on initial state
					const actualHealing = Math.min(
						action.amount,
						target.maxMP - target.currentMP,
					);

					// For MP healing, we'll use a heal outcome with MP context
					// This could be extended to have specific MP heal outcomes in the future
					yield {
						type: "heal", // This should be a specific 'mp_heal' outcome type ideally
						targetId: target.id,
						amount: actualHealing,
					};
					break;
				}

				case "mp_damage": {
					yield {
						type: "mp_cost",
						sourceId: target.id,
						amount: action.amount,
					};
					break;
				}

				case "status_change": {
					yield {
						type: "status_change",
						targetId: target.id,
						status: action.status,
					};
					break;
				}
			}
		}
	}

	/**
	 * Tool for executing XML-defined battle actions
	 */
	public createBattleActionTool(initialCharacters: BattleCharacter[]) {
		return tool({
			description:
				"Execute battle actions defined in XML format. Supports mp_heal, mp_cost, mp_damage, hp_damage, hp_heal with targetId attributes.",
			inputSchema: z.object({
				xmlActions: z
					.string()
					.describe(
						'XML string containing battle actions, e.g., "<hp_damage targetId=\\"char1\\">30</hp_damage><mp_heal targetId=\\"char2\\">20</mp_heal>"',
					),
			}),
			execute: async ({ xmlActions }) => {
				try {
					const actions = this.parseXMLBattleActions(xmlActions);
					const outcomes: BattleOutcome[] = [];

					// Collect all outcomes from the generator
					for (const outcome of this.executeXMLActionsAsOutcomes(
						actions,
						initialCharacters,
					)) {
						outcomes.push(outcome);
					}

					return {
						success: true,
						actionsExecuted: actions.length,
						outcomes,
						message: `Successfully executed ${actions.length} battle action(s)`,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						outcomes: [],
					};
				}
			},
		});
	}

	/**
	 * Build the initial action todos for the AI to resolve
	 */
	private buildActionTodos(initialCharacters: BattleCharacter[]): string[] {
		return this.resolutionQueue.map((character) => {
			const action = character.selectedAction!;
			const target = initialCharacters.find((c) => c.id === action.targetId);
			const targetName = target ? target.name : "an unknown target";

			const skill =
				action.type === ActionType.SKILL
					? this.availableSkills.find((s) => s.id === action.skillId)
					: null;
			const skillName = skill ? skill.name : "Unknown Skill";

			return this.eta
				.renderString(ACTION_TEMPLATE, {
					actionType: action.type,
					characterName: character.name,
					targetName,
					skillName,
				})
				.trim();
		});
	}

	/**
	 * Build the character context string for the AI
	 */
	private buildCharacterContext(characters: BattleCharacter[]): string {
		return this.eta
			.renderString(CHARACTER_CONTEXT_TEMPLATE, { characters })
			.trim();
	}

	/**
	 * Build the system prompt for the AI
	 */
	private buildSystemPrompt(): string {
		return this.eta.renderString(SYSTEM_PROMPT_TEMPLATE, {});
	}

	/**
	 * Build the main prompt for the AI
	 */
	private buildMainPrompt(initialCharacters: BattleCharacter[]): string {
		const characterContext = this.buildCharacterContext(initialCharacters);
		const actionTodos = this.buildActionTodos(initialCharacters);

		return this.eta.renderString(MAIN_PROMPT_TEMPLATE, {
			characterContext,
			actionTodos,
		});
	}

	/**
	 * Create the QED tool for signaling completion
	 */
	private createQedTool() {
		return tool({
			description:
				"Call this tool when all actions in the list have been resolved and the battle turn resolution is finished.",
			inputSchema: z.object({}),
			execute: async () => ({
				success: true,
				message: "Q.E.D. All tasks complete.",
			}),
		});
	}

	private findCharacterById(
		id?: string,
		characters?: BattleCharacter[],
	): BattleCharacter | undefined {
		if (!id || !characters) return undefined;
		return characters.find((c) => c.id === id);
	}
}
