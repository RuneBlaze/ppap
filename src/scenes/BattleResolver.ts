import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { stepCountIs, streamText } from "ai";
import { Eta } from "eta";
import { pipe, sort } from "remeda";
import { z } from "zod";
import { StreamingXMLParser } from "../base/StreamingXMLParser";
import { ActionType, type BattleCharacter, type Skill } from "../battle/types";
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
 * Event when the current topic/active character changes
 */
export interface TopicOutcome extends BaseBattleOutcome {
	type: "topic";
	characterId: string;
	subject?: string; // Optional subject text for JRPG-style banner display
}

/**
 * Event when narrative text should be displayed
 */
export interface NarrativeOutcome extends BaseBattleOutcome {
	type: "narrative";
	text: string;
}

/**
 * Event when the turn resolution ends
 */
export interface TurnEndOutcome extends BaseBattleOutcome {
	type: "turn_end";
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
	| ActionCompleteOutcome
	| TopicOutcome
	| NarrativeOutcome
	| TurnEndOutcome;

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
4.  **Translate to Concrete Effects:** Based on the intent and dice rolls, translate the action into concrete effects using inline XML tags in your narrative text. For example, a successful hit becomes \`<hp_damage targetId="some-enemy">25</hp_damage>\` embedded in your description. A "defend" action becomes \`<status_change targetId="char-id" status="defend" />\`.
5.  **Signal Active Character:** Use \`<topic characterId="character-id" subject="skill-name" />\` to indicate when you're describing a specific character's action. The subject should be a short, descriptive phrase like the skill name or action summary.
6.  **Signal Completion:** Once all actions in the list have been resolved, you MUST include \`<turn_end />\` to signify the end of the turn resolution.

Available XML Tags:
- \`<hp_damage targetId="id">amount</hp_damage>\` - Deal damage to a character
- \`<hp_heal targetId="id">amount</hp_heal>\` - Heal a character
- \`<mp_cost targetId="id">amount</mp_cost>\` - Consume MP from a character
- \`<mp_heal targetId="id">amount</mp_heal>\` - Restore MP to a character
- \`<status_change targetId="id" status="death|defend" />\` - Change character status
- \`<topic characterId="id" subject="action-name" />\` - Signal which character is currently acting with optional subject
- \`<turn_end />\` - Signal the end of turn resolution

Important Context: You will be provided with the current state of all characters in the battle, including their IDs (for \`targetId\`), stats, etc. Use this information to inform your dice rolls and XML tags.`;

/**
 * Template for the main prompt
 */
const MAIN_PROMPT_TEMPLATE = `The turn begins. Here is the current state of the battlefield:

<%= it.characterContext %>

Here are the actions you must resolve, in order:
<% it.actionTodos.forEach(function(todo, i) { %>
<%= i + 1 %>. <%= todo %>
<% }); %>

Please begin resolving the actions. Include <turn_end /> when you have resolved all of them.`;

export class BattleResolver {
	public readonly resolutionQueue: readonly BattleCharacter[];
	private readonly availableSkills: Skill[];
	private readonly eta: Eta;
	private readonly xmlParser: StreamingXMLParser<BattleOutcome>;

	constructor(turnOrder: BattleCharacter[], availableSkills: Skill[]) {
		this.availableSkills = availableSkills;
		this.eta = new Eta();

		// Initialize XML parser with battle-specific tag handlers using Zod schemas
		this.xmlParser = new StreamingXMLParser<BattleOutcome>()
			.registerSelfClosing(
				"topic",
				z.object({
					characterId: z.string().min(1),
					subject: z.string().optional(), // Optional subject for JRPG-style banner
				}),
				(attributes) =>
					({
						type: "topic",
						characterId: attributes.characterId,
						subject: attributes.subject,
					}) as TopicOutcome,
				false,
			)
			.registerSelfClosing(
				"turn_end",
				z.object({}), // No attributes required
				() =>
					({
						type: "turn_end",
					}) as TurnEndOutcome,
				true, // This tag terminates parsing
			)
			.registerSelfClosing(
				"status_change",
				z.object({
					targetId: z.string().min(1),
					status: z.enum(["death", "defend"]),
				}),
				(attributes) =>
					({
						type: "status_change",
						targetId: attributes.targetId,
						status: attributes.status,
					}) as StatusChangeOutcome,
			)
			.registerContent(
				"hp_damage",
				z.object({
					targetId: z.string().min(1),
				}),
				z
					.string()
					.transform((val) => parseInt(val, 10))
					.pipe(z.number().min(0)),
				(attributes, amount) =>
					({
						type: "damage",
						targetId: attributes.targetId,
						amount,
						isCrit: false,
					}) as DamageOutcome,
			)
			.registerContent(
				"hp_heal",
				z.object({
					targetId: z.string().min(1),
				}),
				z
					.string()
					.transform((val) => parseInt(val, 10))
					.pipe(z.number().min(0)),
				(attributes, amount) =>
					({
						type: "heal",
						targetId: attributes.targetId,
						amount,
					}) as HealOutcome,
			)
			.registerContent(
				"mp_cost",
				z.object({
					targetId: z.string().min(1), // Using targetId consistently
				}),
				z
					.string()
					.transform((val) => parseInt(val, 10))
					.pipe(z.number().min(0)),
				(attributes, amount) =>
					({
						type: "mp_cost",
						sourceId: attributes.targetId, // Using targetId as sourceId for API consistency
						amount,
					}) as MpCostOutcome,
			)
			.registerContent(
				"mp_heal",
				z.object({
					targetId: z.string().min(1),
				}),
				z
					.string()
					.transform((val) => parseInt(val, 10))
					.pipe(z.number().min(0)),
				(attributes, amount) =>
					({
						type: "heal", // Treat MP heal as regular heal for now
						targetId: attributes.targetId,
						amount,
					}) as HealOutcome,
			);

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
	 * Now uses streaming XML parsing instead of tools.
	 */
	public async *resolveActionsAsOutcomes(
		initialCharacters: BattleCharacter[],
	): AsyncGenerator<BattleOutcome> {
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
				dice: diceRollTool,
			},
			stopWhen: stepCountIs(10),
		});

		let accumulatedText = "";
		let fullResponseText = "";
		let turnEnded = false;

		for await (const part of result.fullStream) {
			if (part.type === "text") {
				fullResponseText += part.text;
				accumulatedText += part.text;
				// console.log(`[GM]: ${part.text}`);

				// Yield narrative text outcome
				yield {
					type: "narrative",
					text: part.text,
				};

				// Parse and extract XML tags from accumulated text
				const xmlResults = this.xmlParser.parse(accumulatedText);

				// Log any parsing errors but continue processing
				for (const error of xmlResults.errors) {
					console.warn(
						`XML parsing failed for tag '${error.tagName}': ${error.error.message}`,
						{
							rawTag: error.rawTag,
							error: error.error,
						},
					);
				}

				// Validate character existence and yield successful outcomes
				for (const outcome of xmlResults.results) {
					// Validate that referenced characters exist
					const characterId = this.getCharacterIdFromOutcome(outcome);
					if (
						characterId &&
						!initialCharacters.find((c) => c.id === characterId)
					) {
						console.warn(`Character not found for XML outcome:`, outcome);
						continue;
					}
					yield outcome;
				}

				// Update accumulated text to remove processed tags (both successful and failed)
				accumulatedText = xmlResults.remainingText;

				// Check for turn end
				if (xmlResults.terminated) {
					turnEnded = true;
					break;
				}
			}
		}

		console.log(`[GM Full Response]: ${fullResponseText}`);

		// If we didn't get a turn_end tag, yield it anyway
		if (!turnEnded) {
			yield {
				type: "turn_end",
			};
		}
	}

	/**
	 * Extract character ID from an outcome for validation
	 */
	private getCharacterIdFromOutcome(outcome: BattleOutcome): string | null {
		switch (outcome.type) {
			case "topic":
				return outcome.characterId;
			case "damage":
			case "heal":
			case "status_change":
				return outcome.targetId;
			case "mp_cost":
				return outcome.sourceId;
			case "action_start":
			case "action_complete":
				return outcome.sourceId;
			default:
				return null;
		}
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
}
