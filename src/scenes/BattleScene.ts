import { filter, pipe, sample } from "remeda";
import { BattleSprite } from "../base/BattleSprite";
import { BattleStateManager } from "../battle/BattleStateManager";
import {
	type ActionDefinition,
	ActionType,
	type BattleAction,
	type BattleCharacter,
} from "../battle/types";
import { Palette } from "../palette";
import type { NoisePatternShader } from "../shaders/NoisePatternShader";
import { ActionWidget } from "../ui/components/ActionWidget";
import { AllyStatusPanel } from "../ui/components/AllyStatusPanel";
import { BattleQueue, type QueueEntry } from "../ui/components/BattleQueue";
import { ProgressBar } from "../ui/primitives/ProgressBar";
import { TextBlock } from "../ui/primitives/TextBlock";
import { GenericFocusStateMachine } from "../ui/state/GenericFocusStateMachine";
import { BaseScene } from "./BaseScene";
import {
	type BattleFocusEvent,
	type BattleFocusState,
	battleFocusConfig,
} from "./BattleFocusConfig";
import { type BattleOutcome, BattleResolver } from "./BattleResolver";

// ---------------------------------------------------------------------------
// Layout constants for the 427 × 240 battle canvas
// ---------------------------------------------------------------------------
const SCENE_WIDTH = 427;
const SCENE_HEIGHT = 240;
const OUTER_MARGIN = 8;
const WINDOW_WIDTH = SCENE_WIDTH - OUTER_MARGIN * 2;
const ENEMY_WINDOW_HEIGHT = 80;
const PLAYER_WINDOW_HEIGHT = 90;
const VERTICAL_SPACING = 8;
const PORTRAIT_SIZE = 48;

export class BattleScene extends BaseScene {
	private battleFocusManager!: GenericFocusStateMachine<
		BattleFocusState,
		BattleFocusEvent
	>;
	// Battle state manager
	private stateManager!: BattleStateManager;

	// UI elements
	private actionWidgets: ActionWidget[] = [];

	// Character display elements
	private allyStatusPanel: AllyStatusPanel | null = null;
	private battleQueue: BattleQueue | null = null;
	private enemyHPBars: ProgressBar[] = [];
	private enemySprites: BattleSprite[] = [];
	private activePlayerIndicator: Phaser.GameObjects.Graphics | null = null;

	// Layout helpers
	private playerWindowY: number = 0; // populated in createCharacterDisplay

	// Background shader
	private backgroundSprite: Phaser.GameObjects.Image | null = null;
	private backgroundShader: NoisePatternShader | null = null;

	// Debug
	private debugGraphics: Phaser.GameObjects.Graphics | null = null;
	private debugComponentIndex = -1; // -1 is off
	private debugComponents: {
		name: string;
		getBounds: () => Phaser.Geom.Rectangle;
	}[] = [];

	constructor() {
		super("BattleScene");
	}

	protected preloadSceneAssets() {
		// Assets are now preloaded in BootScene
	}

	protected createScene() {
		// Shaders are now registered in BootScene

		this.stateManager = new BattleStateManager();
		this.createUI();
		this.initializeFocusManager(); // Must be after UI is created
		this.initializeDebugComponents(); // Must be after UI is created
		this.startBattle();
		this.activePlayerIndicator = this.add.graphics().setDepth(900);
	}

	private initializeFocusManager() {
		this.battleFocusManager = new GenericFocusStateMachine(
			this,
			battleFocusConfig,
		);

		this.battleFocusManager.on(
			"stateChanged",
			(event: {
				oldState: BattleFocusState;
				newState: BattleFocusState;
				event: BattleFocusEvent;
			}) => {
				console.log(
					`Focus state changed: ${event.oldState.id} → ${event.newState.id} via ${event.event.type}`,
				);

				// If we have just finished selecting an action and are now idle, advance the turn.
				if (
					event.newState.id === "idle" &&
					event.event.type === "confirmAction"
				) {
					this.stateManager.advanceTurnIndex();
					this.processNextCharacter();
					this.activePlayerIndicator?.setVisible(false);
				}

				if (event.newState.id === "actionMenu") {
					this.updateActivePlayerVisuals(event.newState.character);
				}
			},
		);

		// No components need to be registered - using action widgets directly
	}

	private updateActivePlayerVisuals(character: BattleCharacter) {
		// Update the ally status panel to show the active character with animation
		this.allyStatusPanel?.setActiveCharacter(character.id);
		this.animateCharacterTransition(character);

		const playerIndex = this.stateManager
			.getPlayerParty()
			.findIndex((p) => p.id === character.id);
		if (playerIndex === -1) {
			return;
		}

		const playerSectionWidth = 64; // Fixed width of 64px per character
		const panelWidth = this.stateManager.getPlayerParty().length * 64; // 64px per character
		const panelX = (SCENE_WIDTH - panelWidth) / 2; // Center horizontally
		const sectionX = panelX + playerIndex * playerSectionWidth;

		// Get the anchor point for menus (center of the player's section)
		const anchorX = sectionX + playerSectionWidth / 2;

		// 2. Show action widgets in radial layout with animation
		this.showActionWidgets(anchorX, this.playerWindowY - 60);
	}

	private animateCharacterTransition(character: BattleCharacter) {
		// Pokemon B2W2 style character transition effects
		const playerIndex = this.stateManager
			.getPlayerParty()
			.findIndex((p) => p.id === character.id);
		if (playerIndex === -1 || !this.allyStatusPanel) return;

		// Get the character's portrait bounds for animation
		const characterBounds = this.allyStatusPanel.getCharacterSectionBounds(
			character.id,
		);
		if (!characterBounds) return;

		// Create selection flash effect
		const flashGraphics = this.add.graphics();
		flashGraphics.setDepth(200);
		flashGraphics.fillStyle(Palette.YELLOW.num, 0.6);
		flashGraphics.fillRectShape(characterBounds);

		// Flash animation - quick pulse
		this.tweens.add({
			targets: flashGraphics,
			alpha: { from: 0.6, to: 0 },
			duration: 150,
			yoyo: true,
			repeat: 1,
			onComplete: () => flashGraphics.destroy(),
		});

		// Add particle burst effect at character position
		this.addPredefinedAnim(
			"burst",
			characterBounds.x + characterBounds.width / 2,
			characterBounds.y + characterBounds.height / 2,
		);

		// Slight screen shake for impact
		this.cameras.main.shake(100, 0.003);
	}

	private getAvailableActions(character: BattleCharacter): ActionDefinition[] {
		const actions: ActionDefinition[] = [
			{
				id: "attack",
				name: "Attack",
				type: ActionType.ATTACK,
				iconFrame: 0,
			},
			{
				id: "defend",
				name: "Defend",
				type: ActionType.DEFEND,
				iconFrame: 12,
			},
		];

		// Add individual skills that the character can afford
		this.stateManager.getAvailableSkills().forEach((skill, index) => {
			if (character.currentMP >= skill.mpCost) {
				actions.push({
					id: skill.id,
					name: skill.name,
					type: ActionType.SKILL,
					iconFrame: 24 + index, // Different icon per skill
					skillId: skill.id,
					mpCost: skill.mpCost,
					damage: skill.damage,
					healing: skill.healing,
				});
			}
		});

		// Add items (placeholder for now)
		actions.push({
			id: "potion",
			name: "Potion",
			type: ActionType.ITEM,
			iconFrame: 36,
		});

		return actions;
	}

	private showActionWidgets(centerX: number, centerY: number) {
		// Clear existing widgets
		this.hideActionWidgets();

		const currentCharacter = (this.battleFocusManager.getCurrentState() as any)
			.character;
		const availableActions = this.getAvailableActions(currentCharacter);

		// Predefined "random" offsets that look aesthetically pleasing
		const offsets = [
			{ x: -4, y: -6 },
			{ x: 3, y: -1 },
			{ x: -2, y: 4 },
			{ x: 4, y: 8 },
			{ x: -3, y: 12 },
			{ x: 2, y: 16 },
			{ x: -1, y: 20 },
			{ x: 5, y: 24 },
		];

		const verticalSpacing = 20;
		const maxPerColumn = 4;

		availableActions.forEach((actionDef, index) => {
			const column = Math.floor(index / maxPerColumn);
			const row = index % maxPerColumn;
			const offset = offsets[index] || { x: 0, y: 0 };

			const x = centerX + column * 30 + offset.x; // 30px between columns
			const y = centerY - 30 + row * verticalSpacing + offset.y; // Start above center

			const widget = new ActionWidget(this, {
				x,
				y,
				iconKey: "icons",
				iconFrame: actionDef.iconFrame,
				size: 16,
				label: actionDef.name,
				onSelect: () => this.onActionSelected(actionDef),
			});

			// Animate widget appearance with staggered timing
			const animationDelay = index * 50; // 50ms delay between each widget
			widget.setAlpha(0);
			widget.setScale(0.3);

			this.time.delayedCall(animationDelay, () => {
				this.tweens.add({
					targets: widget,
					alpha: { from: 0, to: 1 },
					scaleX: { from: 0.3, to: 1.2 },
					scaleY: { from: 0.3, to: 1.2 },
					duration: 150,
					ease: "Back.easeOut",
					onComplete: () => {
						// Secondary bounce to normal size
						this.tweens.add({
							targets: widget,
							scaleX: { from: 1.2, to: 1 },
							scaleY: { from: 1.2, to: 1 },
							duration: 100,
							ease: "Quad.easeOut",
						});
					},
				});
			});

			this.actionWidgets.push(widget);
		});
	}

	private hideActionWidgets() {
		this.actionWidgets.forEach((widget) => widget.destroy());
		this.actionWidgets = [];
	}

	private onActionSelected(actionDef: ActionDefinition) {
		console.log(`Action selected: ${actionDef.name}`);

		// Hide widgets after selection
		this.hideActionWidgets();

		const currentCharacter = (this.battleFocusManager.getCurrentState() as any)
			.character;

		// Create the battle action with auto-target selection
		const action: BattleAction = {
			type: actionDef.type,
			skillId: actionDef.skillId,
			targetId: this.getRandomTarget(actionDef),
		};

		// Show selected action indicator on character
		this.showSelectedActionIndicator(currentCharacter, actionDef);

		// Execute the action
		this.selectAction(currentCharacter, action);
	}

	private getRandomTarget(actionDef: ActionDefinition): string {
		// For attack actions and damage skills, target enemies
		if (
			actionDef.type === ActionType.ATTACK ||
			(actionDef.damage && actionDef.damage > 0)
		) {
			const aliveEnemies = filter(
				this.stateManager.getEnemyParty(),
				(e) => e.isAlive,
			);
			const randomEnemy = sample(aliveEnemies, 1)[0];
			return randomEnemy?.id || "";
		}

		// For healing skills, target allies
		if (actionDef.healing && actionDef.healing > 0) {
			const aliveAllies = filter(
				this.stateManager.getPlayerParty(),
				(p) => p.isAlive,
			);
			const randomAlly = sample(aliveAllies, 1)[0];
			return randomAlly?.id || "";
		}

		// For defend and items, no target needed
		return "";
	}

	private showSelectedActionIndicator(
		character: BattleCharacter,
		actionDef: ActionDefinition,
	) {
		// Use the new badge system in AllyStatusPanel
		this.allyStatusPanel?.showActionBadge(
			character.id,
			actionDef.name,
			actionDef.iconFrame,
		);
	}

	private hideSelectedActionIndicator(characterId: string) {
		// Use the new badge system in AllyStatusPanel
		this.allyStatusPanel?.hideActionBadge(characterId);
	}

	private initializeDebugComponents() {
		this.debugGraphics = this.add.graphics();
		this.debugGraphics.setDepth(999); // Ensure it's on top

		// --- Enemy Window ---
		this.debugComponents.push({
			name: "Enemy Window",
			getBounds: () =>
				new Phaser.Geom.Rectangle(
					OUTER_MARGIN,
					OUTER_MARGIN,
					WINDOW_WIDTH,
					ENEMY_WINDOW_HEIGHT,
				),
		});

		// --- Player Status Window ---
		this.debugComponents.push({
			name: "Player Status",
			getBounds: () =>
				new Phaser.Geom.Rectangle(
					OUTER_MARGIN,
					this.playerWindowY,
					WINDOW_WIDTH,
					PLAYER_WINDOW_HEIGHT,
				),
		});

		// Setup debug event listeners
		this.events.on("debug:cycleBattleHighlight", () => {
			this.cycleDebugHighlight();
		});

		this.events.on("debug:resetBattleHighlight", () => {
			this.resetDebugHighlight();
		});
	}

	private cycleDebugHighlight() {
		if (!this.debugGraphics) return;

		this.debugComponentIndex =
			(this.debugComponentIndex + 1) % (this.debugComponents.length + 1);

		this.debugGraphics.clear();

		if (this.debugComponentIndex >= this.debugComponents.length) {
			// This is the "off" state
			console.log("Debug highlight OFF");
			this.updateDebugUIHighlight("Off");
			return;
		}

		const component = this.debugComponents[this.debugComponentIndex];
		const bounds = component.getBounds();

		console.log(`Debug highlight: ${component.name}`);
		this.updateDebugUIHighlight(component.name);

		this.debugGraphics.fillStyle(Palette.YELLOW.num, 0.3);
		this.debugGraphics.fillRectShape(bounds);
		this.debugGraphics.lineStyle(2, Palette.YELLOW.num);
		this.debugGraphics.strokeRectShape(bounds);
	}

	private resetDebugHighlight() {
		if (!this.debugGraphics) return;

		this.debugComponentIndex = -1;
		this.debugGraphics.clear();
		this.updateDebugUIHighlight("Off");
		console.log("Debug highlight reset");
	}

	private updateDebugUIHighlight(highlightName: string) {
		// Update the HTML UI state
		if (typeof window !== "undefined" && window.debugStore) {
			window.debugStore.battleHighlight = highlightName;
		}
	}

	private createUI() {
		// Create main battle UI layout
		this.createBattleLayout();
		this.createCharacterDisplay();
	}

	private createBattleLayout() {
		// Create animated background with shader
		this.backgroundSprite = this.add.image(
			SCENE_WIDTH / 2,
			SCENE_HEIGHT / 2,
			"backgroundTexture",
		);
		this.backgroundSprite.setDisplaySize(SCENE_WIDTH, SCENE_HEIGHT);
		this.backgroundSprite.setDepth(-100); // Ensure it's behind everything

		// Apply the time gradient shader
		try {
			this.backgroundSprite.setPostPipeline("NoisePattern");
			this.backgroundShader = this.backgroundSprite.getPostPipeline(
				"NoisePattern",
			) as NoisePatternShader;
			if (this.backgroundShader) {
				this.backgroundShader.speed = 0.5; // Adjust animation speed
			}
		} catch (error) {
			console.warn(
				"Could not apply NoisePattern shader, falling back to static background:",
				error,
			);
			// Fallback to static background
			this.backgroundSprite.destroy();
			const graphics = this.add.graphics();
			graphics.fillStyle(Palette.BLUE.num);
			graphics.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
		}

		// Scene title
		new TextBlock(this, {
			x: OUTER_MARGIN,
			y: OUTER_MARGIN,
			text: "Battle Scene",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});
	}

	private createCharacterDisplay() {
		/* ---------------- Enemy Sprites -------------------------------------- */
		const enemyWindowX = OUTER_MARGIN;
		const enemyWindowY = OUTER_MARGIN;
		const enemyParty = this.stateManager.getEnemyParty();
		const enemySectionWidth = WINDOW_WIDTH / enemyParty.length;
		enemyParty.forEach((enemy, index) => {
			const sectionStartX = enemyWindowX + enemySectionWidth * index;
			const centerX = sectionStartX + enemySectionWidth / 2;

			// Use BattleSprite instead of placeholder graphics
			const spriteX = centerX;
			const spriteY = enemyWindowY + 30;

			// From pineapple-pen/assets/enemies.json: goblin is 18, orc is not in this sheet. Use 2.
			const frame = enemy.name === "Goblin" ? 18 : 2;
			const enemySprite = new BattleSprite(
				this,
				spriteX,
				spriteY,
				"enemies",
				frame,
			);
			enemySprite.setScale(PORTRAIT_SIZE / 64); // Scale down 64x64 sprite
			this.enemySprites.push(enemySprite);

			// Name label (roughly centred)
			new TextBlock(this, {
				x: centerX - enemy.name.length * 4,
				y: enemyWindowY + 2,
				text: enemy.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
				align: "center",
			});

			// Enemy HP Bar
			const barWidth = 60;
			const barX = centerX - barWidth / 2;
			const barY = spriteY + PORTRAIT_SIZE / 2 + 4;
			const enemyHpBar = new ProgressBar(this, {
				x: barX,
				y: barY,
				width: barWidth,
				height: 6,
				value: enemy.currentHP,
				maxValue: enemy.maxHP,
				gradientStart: Palette.RED.hex,
				gradientEnd: Palette.RED.hex,
			});
			this.enemyHPBars.push(enemyHpBar);
		});

		/* ---------------- Player Window (Ally Status Panel) --------------- */
		const playerWindowY = SCENE_HEIGHT - 10 - PLAYER_WINDOW_HEIGHT; // 10px from bottom
		this.playerWindowY = playerWindowY; // expose for other UI elements

		// Create the ally status panel component - horizontally centered
		const playerParty = this.stateManager.getPlayerParty();
		const panelWidth = playerParty.length * 64; // 64px per character
		const panelX = (SCENE_WIDTH - panelWidth) / 2; // Center horizontally
		this.allyStatusPanel = new AllyStatusPanel(this, {
			x: panelX,
			y: playerWindowY,
			width: panelWidth,
			height: PLAYER_WINDOW_HEIGHT,
			characters: playerParty,
		});
		this.allyStatusPanel.create();

		// Create the battle queue on the left side
		this.battleQueue = new BattleQueue(this, {
			x: OUTER_MARGIN,
			y: OUTER_MARGIN + ENEMY_WINDOW_HEIGHT + VERTICAL_SPACING,
			width: 120,
			maxVisible: 6,
		});
		this.battleQueue.create();
	}

	private startBattle() {
		this.processNextCharacter();
	}

	private processNextCharacter() {
		// Don't process if we're in the middle of resolving actions
		if (this.stateManager.isCurrentlyResolvingActions()) {
			console.log(
				"Skipping processNextCharacter - currently resolving actions",
			);
			return;
		}

		if (this.stateManager.isCurrentTurnComplete()) {
			// All characters have acted, resolve actions
			console.log("All characters have acted, starting resolution...");
			this.resolveActions();
			return;
		}

		const currentCharacter = this.stateManager.getCurrentCharacter();
		if (!currentCharacter) return;

		console.log(
			`Processing character ${this.stateManager.getTurnIndex() + 1}/${this.stateManager.getTurnOrder().length}: ${currentCharacter.name} (${currentCharacter.isPlayer ? "Player" : "Enemy"})`,
		);

		if (currentCharacter.isPlayer) {
			// Player turn is now started by sending an event to the FSM
			this.battleFocusManager.sendEvent({
				type: "startPlayerTurn",
				character: currentCharacter,
			});
		} else {
			this.processEnemyAction(currentCharacter);
		}
	}

	// =========================================================================
	// Action Selection Logic
	// Now handled directly via action widgets
	// =========================================================================

	private selectAction(character: BattleCharacter, action: BattleAction) {
		character.selectedAction = action;

		// Tell the FSM the action is done. The stateChanged listener will handle advancing the turn.
		this.battleFocusManager.sendEvent({ type: "confirmAction", action });
	}

	private processEnemyAction(character: BattleCharacter) {
		// Simple AI: enemies always attack a random player
		const randomTarget = pipe(
			this.stateManager.getPlayerParty(),
			filter((p) => p.isAlive),
			sample(1),
		)[0];

		if (!randomTarget) {
			console.warn("No living players for enemy to target.");
			this.stateManager.advanceTurnIndex();
			this.processNextCharacter();
			return;
		}

		character.selectedAction = {
			type: ActionType.ATTACK,
			targetId: randomTarget.id,
		};

		// Move to next character
		this.stateManager.advanceTurnIndex();
		this.processNextCharacter();
	}

	private async resolveActions() {
		console.log("Resolving all actions...");

		// Prevent double resolution
		if (this.stateManager.isCurrentlyResolvingActions()) {
			console.log("Already resolving actions, skipping...");
			return;
		}
		this.stateManager.setResolvingActions(true);

		const resolver = new BattleResolver(
			this.stateManager.getTurnOrder(),
			this.stateManager.getAvailableSkills(),
		);

		// Build battle queue entries from the resolver's calculated queue
		const queueEntries: QueueEntry[] = resolver.resolutionQueue.map(
			(character) => ({
				characterId: character.id,
				characterName: character.name,
				isPlayer: character.isPlayer,
				actionName: character.isPlayer
					? this.getActionDisplayName(character.selectedAction!)
					: undefined, // Enemy actions hidden initially
				actionIconFrame: character.isPlayer
					? this.getActionIconFrame(character.selectedAction!)
					: undefined,
				isRevealed: character.isPlayer, // Player actions always revealed
			}),
		);

		this.battleQueue?.setQueue(queueEntries);

		// Use the new outcome-based resolution system

		const initialCharacters = this.stateManager.getTurnOrder();
		for await (const outcome of resolver.resolveActionsAsOutcomes(
			initialCharacters,
		)) {
			// Handle each outcome event with dedicated handlers
			await this.handleBattleOutcome(outcome);

			// Track when we start a new action for queue management
			if (outcome.type === "action_start") {
				// Reveal enemy action in the queue UI
				const character = this.stateManager.findCharacterById(outcome.sourceId);
				if (character && !character.isPlayer) {
					const actionName = this.getActionDisplayName(
						character.selectedAction!,
					);
					const iconFrame = this.getActionIconFrame(character.selectedAction!);
					this.battleQueue?.revealEnemyAction(
						character.id,
						actionName,
						iconFrame,
					);
				}
			}

			// Advance the UI queue when an action completes
			if (outcome.type === "action_complete") {
				this.battleQueue?.nextEntry();
			}
		}

		this.finishResolution();
	}

	/**
	 * Central handler that delegates outcome events to specific handler methods
	 */
	private async handleBattleOutcome(outcome: BattleOutcome): Promise<void> {
		switch (outcome.type) {
			case "action_start":
				return this.onActionStart(outcome);
			case "damage":
				this.stateManager.applyDamage(outcome.targetId, outcome.amount);
				return this.onDamage(outcome);
			case "heal":
				this.stateManager.applyHealing(outcome.targetId, outcome.amount);
				return this.onHeal(outcome);
			case "mp_cost":
				this.stateManager.applyMpCost(outcome.sourceId, outcome.amount);
				return this.onMpCost(outcome);
			case "status_change":
				this.stateManager.applyStatusChange(outcome.targetId, outcome.status);
				return this.onStatusChange(outcome);
			case "action_complete":
				return this.onActionComplete(outcome);
			default:
				console.warn("Unhandled battle outcome type:", outcome);
		}
	}

	/**
	 * Handler for when an action starts
	 */
	private async onActionStart(outcome: {
		type: "action_start";
		sourceId: string;
		actionType: ActionType;
	}): Promise<void> {
		const character = this.stateManager.findCharacterById(outcome.sourceId);
		if (!character) return;

		console.log(`${character.name} starts ${outcome.actionType}`);

		// Flash the character performing the action
		if (character.isPlayer) {
			const characterBounds = this.allyStatusPanel?.getCharacterSectionBounds(
				character.id,
			);
			if (characterBounds) {
				const flash = this.add.graphics();
				flash.fillStyle(Palette.WHITE.num, 0.5);
				flash.fillRectShape(characterBounds);
				flash.setDepth(150);
				this.tweens.add({
					targets: flash,
					alpha: { from: 0.5, to: 0 },
					duration: 300,
					onComplete: () => flash.destroy(),
				});
			}
		} else {
			const enemyIndex = this.stateManager
				.getEnemyParty()
				.findIndex((e) => e.id === character.id);
			if (enemyIndex !== -1 && this.enemySprites[enemyIndex]) {
				this.enemySprites[enemyIndex].flash();
			}
		}

		// Small delay for action start feedback
		return new Promise((resolve) => this.time.delayedCall(200, resolve));
	}

	/**
	 * Handler for damage events
	 */
	private async onDamage(outcome: {
		type: "damage";
		targetId: string;
		amount: number;
		isCrit: boolean;
	}): Promise<void> {
		const target = this.stateManager.findCharacterById(outcome.targetId);
		if (!target) return;

		console.log(
			`${target.name} takes ${outcome.amount} damage${outcome.isCrit ? " (CRITICAL!)" : ""}!`,
		);

		// Update displays now that state is changed
		this.updatePlayerDisplay();
		this.updateEnemyDisplay();

		// TODO: Add floating damage number popup here
		// TODO: Add screen shake on crits
		if (outcome.isCrit) {
			this.cameras.main.shake(150, 0.005);
		}

		return new Promise((resolve) => this.time.delayedCall(300, resolve));
	}

	/**
	 * Handler for healing events
	 */
	private async onHeal(outcome: {
		type: "heal";
		targetId: string;
		amount: number;
	}): Promise<void> {
		const target = this.stateManager.findCharacterById(outcome.targetId);
		if (!target) return;

		console.log(`${target.name} recovers ${outcome.amount} HP!`);

		// Update displays now that state is changed
		this.updatePlayerDisplay();
		this.updateEnemyDisplay();

		// TODO: Add floating healing number popup here
		// TODO: Add green flash effect

		return new Promise((resolve) => this.time.delayedCall(300, resolve));
	}

	/**
	 * Handler for MP cost events
	 */
	private async onMpCost(outcome: {
		type: "mp_cost";
		sourceId: string;
		amount: number;
	}): Promise<void> {
		const source = this.stateManager.findCharacterById(outcome.sourceId);
		if (!source) return;

		console.log(`${source.name} uses ${outcome.amount} MP`);

		// Update displays to show MP changes
		this.updatePlayerDisplay();

		// TODO: Add blue flash or MP drain effect

		return new Promise((resolve) => this.time.delayedCall(150, resolve));
	}

	/**
	 * Handler for status change events
	 */
	private async onStatusChange(outcome: {
		type: "status_change";
		targetId: string;
		status: "death" | "defend";
	}): Promise<void> {
		const target = this.stateManager.findCharacterById(outcome.targetId);
		if (!target) return;

		// The state is already updated by the stateManager, so we just log and animate.
		switch (outcome.status) {
			case "death":
				console.log(`${target.name} has been defeated!`);
				// TODO: Add death animation/effect
				break;
			case "defend":
				console.log(`${target.name} takes a defensive stance!`);
				// TODO: Add defend visual effect
				break;
		}

		return new Promise((resolve) => this.time.delayedCall(400, resolve));
	}

	/**
	 * Handler for when an action completes
	 */
	private async onActionComplete(outcome: {
		type: "action_complete";
		sourceId: string;
	}): Promise<void> {
		const source = this.stateManager.findCharacterById(outcome.sourceId);
		if (source) {
			console.log(`${source.name} completes their action`);
		}

		// Small delay before next action
		return new Promise((resolve) => this.time.delayedCall(100, resolve));
	}

	private finishResolution() {
		console.log("Finishing resolution phase...");
		this.stateManager.setResolvingActions(false);

		// Check for battle end conditions
		if (this.checkBattleEnd()) {
			return;
		}

		// Hide the battle queue with a brief delay for visual feedback
		this.time.delayedCall(1000, () => {
			this.battleQueue?.setQueue([]);
			console.log("Battle queue cleared, starting next turn...");

			// Start next turn
			this.startNextTurn();
		});
	}

	private getActionDisplayName(action: BattleAction): string {
		switch (action.type) {
			case ActionType.ATTACK:
				return "Attack";
			case ActionType.DEFEND:
				return "Defend";
			case ActionType.SKILL: {
				const skill = this.stateManager
					.getAvailableSkills()
					.find((s) => s.id === action.skillId);
				return skill?.name || "Skill";
			}
			case ActionType.ITEM:
				return "Item";
			default:
				return "Action";
		}
	}

	private getActionIconFrame(action: BattleAction): number {
		switch (action.type) {
			case ActionType.ATTACK:
				return 0;
			case ActionType.DEFEND:
				return 12;
			case ActionType.SKILL: {
				const skillIndex = this.stateManager
					.getAvailableSkills()
					.findIndex((s) => s.id === action.skillId);
				return 24 + (skillIndex >= 0 ? skillIndex : 0);
			}
			case ActionType.ITEM:
				return 36;
			default:
				return 0;
		}
	}

	private updatePlayerDisplay() {
		// Update the ally status panel with current character data
		if (
			this.allyStatusPanel &&
			this.scene.scene &&
			(this.scene.scene as any).isActive
		) {
			this.allyStatusPanel.setCharacters(this.stateManager.getPlayerParty());
			this.allyStatusPanel.updateDisplay();
		}
	}

	private updateEnemyDisplay() {
		if (!this.scene.scene || !(this.scene.scene as any).isActive) return;

		this.stateManager.getEnemyParty().forEach((enemy, index) => {
			const { currentHP } = enemy;
			const hpBar = this.enemyHPBars[index];
			if (
				hpBar &&
				hpBar.scene &&
				hpBar.scene.scene &&
				(hpBar.scene.scene as any).isActive
			) {
				hpBar.setValue(currentHP, true);
			}
		});
	}

	private checkBattleEnd(): boolean {
		const result = this.stateManager.checkBattleEnd();

		if (result.isEnded) {
			if (result.victory) {
				console.log("Victory! All enemies defeated.");
				this.scene.start("VictoryScene"); // Assuming you have a victory scene
			} else {
				console.log("Game Over! All players defeated.");
				this.scene.start("GameOverScene"); // Assuming you have a game over scene
			}
			return true;
		}

		return false;
	}

	private startNextTurn() {
		console.log("Starting new turn...");

		// Clear action indicators for player characters
		this.stateManager.getTurnOrder().forEach((character) => {
			if (character.isPlayer) {
				this.hideSelectedActionIndicator(character.id);
			}
		});

		// Use state manager to handle turn reset
		this.stateManager.startNextTurn();

		console.log(
			"New turn order:",
			this.stateManager.getTurnOrder().map((c) => ({
				id: c.id,
				name: c.name,
				isPlayer: c.isPlayer,
			})),
		);

		// Start new turn
		this.processNextCharacter();
	}

	update(time: number, delta: number): void {
		super.update(time, delta);

		if (this.backgroundShader) {
			// The time property is a setter that expects ms
			this.backgroundShader.time = time;
		}
	}
}
