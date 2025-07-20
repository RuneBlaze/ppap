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
import { ActionMenu } from "../ui/components/ActionMenu";
import { AllyStatusPanel } from "../ui/components/AllyStatusPanel";
import { NarrativeLog } from "../ui/components/NarrativeLog";
import { Popup } from "../ui/primitives/Popup";
import { ProgressBar } from "../ui/primitives/ProgressBar";
import { SubjectBanner } from "../ui/primitives/SubjectBanner";
import { TextBlock } from "../ui/primitives/TextBlock";
import { GenericFocusStateMachine } from "../ui/state/GenericFocusStateMachine";
import { sleep } from "../utils/async";
import {
	createCharacterMap,
	sanitizeNarrativeText,
} from "../utils/narrative-sanitizer";
import { BaseScene } from "./BaseScene";
import {
	type BattleFocusEvent,
	type BattleFocusState,
	battleFocusConfig,
} from "./BattleFocusConfig";
import {
	type BattleOutcome,
	BattleResolver,
	type NarrativeOutcome,
} from "./BattleResolver";

// ---------------------------------------------------------------------------
// Layout constants for the 427 × 240 battle canvas
// ---------------------------------------------------------------------------
const SCENE_WIDTH = 427;
const SCENE_HEIGHT = 240;
const OUTER_MARGIN = 8;
const WINDOW_WIDTH = SCENE_WIDTH - OUTER_MARGIN * 2;
const PLAYER_WINDOW_HEIGHT = 90;
const NARRATIVE_LOG_HEIGHT = 16;
const PORTRAIT_SIZE = 48;
const ENEMY_BASE_Y_POSITION = 83; // Base vertical position for all enemy sprites

export class BattleScene extends BaseScene {
	private battleFocusManager!: GenericFocusStateMachine<
		BattleFocusState,
		BattleFocusEvent
	>;
	// Battle state manager
	private stateManager!: BattleStateManager;

	// Chunk-and-play system
	private outcomeQueue: BattleOutcome[] = [];
	private isStreamingComplete = false;

	// UI elements
	private actionMenu: ActionMenu | null = null;

	// Character display elements
	private allyStatusPanel: AllyStatusPanel | null = null;
	private subjectBanner: SubjectBanner | null = null;
	private narrativeLog: NarrativeLog | null = null;
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

		// 2. Show action menu above active character
		// Position it relative to the bottom of the screen, above the player window
		this.showActionMenu(anchorX, SCENE_HEIGHT - PLAYER_WINDOW_HEIGHT - 60);
	}

	private updateActiveCharacterVisuals(character: BattleCharacter) {
		// Clear previous highlighting
		this.clearActiveCharacterVisuals();

		if (character.isPlayer) {
			// Update the ally status panel to show the active character
			this.allyStatusPanel?.setActiveCharacter(character.id);
		} else {
			// Clear ally highlighting since enemy is active
			this.allyStatusPanel?.setActiveCharacter(null);

			// Highlight enemy sprite
			const enemyIndex = this.stateManager
				.getEnemyParty()
				.findIndex((e) => e.id === character.id);
			if (enemyIndex !== -1 && this.enemySprites[enemyIndex]) {
				this.highlightEnemySprite(enemyIndex);
			}
		}

		this.animateCharacterTransition(character);
	}

	private clearActiveCharacterVisuals() {
		// Clear enemy highlighting
		this.enemySprites.forEach((sprite) => {
			this.tweens.killTweensOf(sprite);
			sprite.setAlpha(1.0);
		});
	}

	private highlightEnemySprite(enemyIndex: number) {
		const enemySprite = this.enemySprites[enemyIndex];
		if (!enemySprite) return;

		// Dim other enemies
		this.enemySprites.forEach((sprite, index) => {
			if (index !== enemyIndex) {
				this.tweens.add({
					targets: sprite,
					alpha: { from: sprite.alpha, to: 0.4 },
					duration: 200,
					ease: "Quad.easeOut",
				});
			}
		});

		// Highlight active enemy with pulsing effect
		this.tweens.add({
			targets: enemySprite,
			alpha: { from: 1.0, to: 0.85 },
			duration: 800,
			yoyo: true,
			repeat: -1,
			ease: "Sine.easeInOut",
		});
	}

	private animateCharacterTransition(character: BattleCharacter) {
		// Clean character transition effects - just highlight, no burst/damage effects
		const playerIndex = this.stateManager
			.getPlayerParty()
			.findIndex((p) => p.id === character.id);
		if (playerIndex === -1 || !this.allyStatusPanel) return;

		// Get the character's portrait bounds for animation
		const characterBounds = this.allyStatusPanel.getCharacterSectionBounds(
			character.id,
		);
		if (!characterBounds) return;

		// Create selection flash effect - more subtle
		const flashGraphics = this.add.graphics();
		flashGraphics.setDepth(200);
		flashGraphics.fillStyle(Palette.GOLD.num, 0.4); // Use gold instead of yellow, more subtle
		flashGraphics.fillRectShape(characterBounds);

		// Flash animation - gentle highlight
		this.tweens.add({
			targets: flashGraphics,
			alpha: { from: 0.4, to: 0 },
			duration: 200,
			yoyo: true,
			repeat: 1,
			onComplete: () => flashGraphics.destroy(),
		});

		// No burst effect - removed to avoid confusion with damage
		// No screen shake - too aggressive for just becoming active
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

	private showActionMenu(centerX: number, centerY: number) {
		// Clear existing menu
		this.hideActionMenu();

		const currentCharacter = (this.battleFocusManager.getCurrentState() as any)
			.character;
		const availableActions = this.getAvailableActions(currentCharacter);

		// Create action menu
		this.actionMenu = new ActionMenu(this, {
			x: centerX,
			y: centerY,
			actions: availableActions,
			onSelect: (action) => this.onActionSelected(action),
		});

		// Animate menu appearance
		this.actionMenu.setAlpha(0);
		this.actionMenu.setScale(0.8);

		this.tweens.add({
			targets: this.actionMenu,
			alpha: { from: 0, to: 1 },
			scaleX: { from: 0.8, to: 1 },
			scaleY: { from: 0.8, to: 1 },
			duration: 200,
			ease: "Back.easeOut",
		});
	}

	private hideActionMenu() {
		if (this.actionMenu) {
			this.actionMenu.destroy();
			this.actionMenu = null;
		}
	}

	private onActionSelected(actionDef: ActionDefinition) {
		console.log(`Action selected: ${actionDef.name}`);

		// Hide menu after selection
		this.hideActionMenu();

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

		// --- Enemy Area ---
		this.debugComponents.push({
			name: "Enemy Area",
			getBounds: () => {
				// Calculate bounds that encompass all enemy sprites
				const enemyParty = this.stateManager.getEnemyParty();
				if (enemyParty.length === 0) {
					return new Phaser.Geom.Rectangle(
						OUTER_MARGIN,
						OUTER_MARGIN,
						WINDOW_WIDTH,
						80,
					);
				}
				const spriteHeight = PORTRAIT_SIZE;
				const topY = OUTER_MARGIN;
				const bottomY = ENEMY_BASE_Y_POSITION + spriteHeight / 2;
				return new Phaser.Geom.Rectangle(
					OUTER_MARGIN,
					topY,
					WINDOW_WIDTH,
					bottomY - topY,
				);
			},
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
		this.createSubjectBanner();
		this.createNarrativeLog();
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
		const enemyParty = this.stateManager.getEnemyParty();
		const enemySpriteWidth = PORTRAIT_SIZE; // Assuming enemy sprites are also PORTRAIT_SIZE wide after scaling
		const enemyMargin = 16; // Margin between enemy sprites
		const totalEnemiesWidth =
			enemyParty.length * enemySpriteWidth +
			(enemyParty.length - 1) * enemyMargin;
		const startX = (SCENE_WIDTH - totalEnemiesWidth) / 2;

		enemyParty.forEach((enemy, index) => {
			const spriteX =
				startX +
				index * (enemySpriteWidth + enemyMargin) +
				enemySpriteWidth / 2;
			const spriteY = ENEMY_BASE_Y_POSITION;

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

			// Enemy HP Bar
			const barWidth = 60;
			const barY = spriteY + PORTRAIT_SIZE / 2 + 4;

			// Name label positioned above HP bar with 1px gap, left-aligned
			new TextBlock(this, {
				x: spriteX - barWidth / 2, // Left-aligned with HP bar
				y: barY - 9, // 1px gap above HP bar (8px font height + 1px gap)
				text: enemy.name,
				fontKey: "capitalHill",
				color: Palette.WHITE.hex,
				align: "left",
			});
			const enemyHpBar = new ProgressBar(this, {
				x: spriteX - barWidth / 2,
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
		const playerWindowY = SCENE_HEIGHT - PLAYER_WINDOW_HEIGHT - 1; // 1px from bottom
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
	}

	private createSubjectBanner() {
		// Create a compact subject banner centered at the top for skill names
		const bannerWidth = 200; // Much narrower
		const bannerHeight = 24; // Much shorter - just enough for 1-2 lines

		this.subjectBanner = new SubjectBanner(this, {
			x: (SCENE_WIDTH - bannerWidth) / 2, // Center horizontally
			y: OUTER_MARGIN + 20, // Slightly below the top edge
			width: bannerWidth,
			height: bannerHeight,
			fontKey: "capitalHill", // Use Capital Hill font for prominence
		});

		// Start hidden
		this.subjectBanner.setAlpha(0);
	}

	private createNarrativeLog() {
		// Position as footer at the very bottom of the screen
		const logY = SCENE_HEIGHT - NARRATIVE_LOG_HEIGHT; // No margin - full footer

		this.narrativeLog = new NarrativeLog(this, {
			x: 0, // Full width footer
			y: logY,
			width: SCENE_WIDTH, // Full screen width
			height: NARRATIVE_LOG_HEIGHT,
			fontKey: "everydayStandard",
			maxLines: 2, // Only show 2 lines in the footer
		});

		// Start hidden
		this.narrativeLog.setAlpha(0);
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

		const initialCharacters = this.stateManager.getTurnOrder();

		// Reset queue state
		this.outcomeQueue = [];
		this.isStreamingComplete = false;

		// Start concurrent processes
		const streamingPromise = this.streamOutcomesToQueue(
			resolver,
			initialCharacters,
		);
		const processingPromise = this.processOutcomeQueue();

		// Wait for both to complete
		await Promise.all([streamingPromise, processingPromise]);

		this.finishResolution();
	}

	/**
	 * Stream outcomes from the resolver into the queue concurrently
	 */
	private async streamOutcomesToQueue(
		resolver: BattleResolver,
		initialCharacters: BattleCharacter[],
	): Promise<void> {
		try {
			for await (const outcome of resolver.resolveActionsAsOutcomes(
				initialCharacters,
			)) {
				this.outcomeQueue.push(outcome);
			}
		} catch (error) {
			console.error("Error during outcome streaming:", error);
		} finally {
			this.isStreamingComplete = true;
		}
	}

	/**
	 * Process the outcome queue using "chunk-and-play" logic
	 */
	private async processOutcomeQueue(): Promise<void> {
		while (this.outcomeQueue.length > 0 || !this.isStreamingComplete) {
			// Wait for at least one outcome or streaming completion
			if (this.outcomeQueue.length === 0) {
				await sleep(50); // Small wait
				continue;
			}

			// 1. Collect a "chunk" - events from topic to next topic or turn_end
			const chunk: BattleOutcome[] = [];
			let hasTopicEvent = false;

			while (this.outcomeQueue.length > 0) {
				const outcome = this.outcomeQueue.shift()!;
				chunk.push(outcome);

				if (outcome.type === "topic") {
					hasTopicEvent = true;
				}

				// Chunk ends with turn_end or when we hit next topic (after having one)
				if (outcome.type === "turn_end") {
					break;
				}
				if (hasTopicEvent && outcome.type === "topic" && chunk.length > 1) {
					// Put the new topic back and process current chunk
					this.outcomeQueue.unshift(outcome);
					chunk.pop();
					break;
				}
			}

			if (chunk.length === 0) continue;

			// 2. Present narrative text from the chunk
			const narrativeEvents = chunk.filter(
				(e) => e.type === "narrative",
			) as NarrativeOutcome[];
			if (narrativeEvents.length > 0) {
				// Create character map for placeholder replacement
				const allCharacters = [
					...this.stateManager.getPlayerParty(),
					...this.stateManager.getEnemyParty(),
				];
				const characterMap = createCharacterMap(allCharacters);

				// Process each narrative message
				for (const narrative of narrativeEvents) {
					// Sanitize the narrative text
					const sanitizedText = sanitizeNarrativeText(
						narrative.text,
						characterMap,
					);

					if (sanitizedText) {
						// Show narrative log if it's hidden
						if (this.narrativeLog && this.narrativeLog.alpha === 0) {
							this.narrativeLog.show();
						}

						// Add sanitized text to narrative log
						this.narrativeLog?.addMessage(sanitizedText);
					}
				}
			}

			// 3. Pause for anticipation
			await sleep(300);

			// 4. Execute visual effects concurrently
			const visualPromises: Promise<void>[] = [];
			for (const outcome of chunk) {
				if (outcome.type !== "narrative") {
					const promise = this.handleBattleOutcome(outcome);
					if (promise) {
						visualPromises.push(promise);
					}
				}
			}

			// 5. Wait for all visual effects to complete
			await Promise.all(visualPromises);

			// 6. Pause for reaction
			await sleep(500);

			// 7. Topic cleanup: fade out banner and pause
			this.subjectBanner?.hide();
			await sleep(500);

			// 8. Check if this was the final chunk
			if (chunk.some((e) => e.type === "turn_end")) {
				break;
			}
		}
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
			case "topic":
				return this.onTopic(outcome);
			case "narrative":
				// Narrative events are handled in processOutcomeQueue, skip here
				return Promise.resolve();
			case "turn_end":
				return this.onTurnEnd(outcome);
			default:
				console.warn("Unhandled battle outcome type:", outcome);
				return Promise.resolve();
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

		// Return promise that resolves when flash animation completes
		if (character.isPlayer) {
			const characterBounds = this.allyStatusPanel?.getCharacterSectionBounds(
				character.id,
			);
			if (characterBounds) {
				const flash = this.add.graphics();
				flash.fillStyle(Palette.WHITE.num, 0.5);
				flash.fillRectShape(characterBounds);
				flash.setDepth(150);
				return new Promise<void>((resolve) => {
					this.tweens.add({
						targets: flash,
						alpha: { from: 0.5, to: 0 },
						duration: 300,
						onComplete: () => {
							flash.destroy();
							resolve();
						},
					});
				});
			}
		} else {
			const enemyIndex = this.stateManager
				.getEnemyParty()
				.findIndex((e) => e.id === character.id);
			if (enemyIndex !== -1 && this.enemySprites[enemyIndex]) {
				// Flash animation promise handled by BattleSprite flash method
				this.enemySprites[enemyIndex].flash();
			}
		}

		// Default delay for action start feedback
		return sleep(200);
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

		// Get target coordinates
		const coords = this.getTargetCoordinates(outcome.targetId);
		if (!coords) {
			console.warn(
				`[onDamage] Could not get coordinates for target ${target.name} (${outcome.targetId}), skipping animations.`,
			);
		}
		if (coords) {
			// Create damage popup
			new Popup(this, coords.x, coords.y, {
				type: "HpChange",
				delta: -outcome.amount,
				isCritical: outcome.isCrit,
			});

			// Add burst animation
			this.addPredefinedAnim("burst", coords.x, coords.y);
		}

		// Update displays now that state is changed
		this.updatePlayerDisplay();
		this.updateEnemyDisplay();

		if (outcome.isCrit) {
			this.cameras.main.shake(150, 0.005);
		}

		return sleep(300);
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

		// Get target coordinates
		const coords = this.getTargetCoordinates(outcome.targetId);
		if (coords) {
			// Create healing popup
			new Popup(this, coords.x, coords.y, {
				type: "HpChange",
				delta: outcome.amount,
				isCritical: false,
			});

			// Add heal animation
			this.addPredefinedAnim("heal", coords.x, coords.y);
		}

		// Update displays now that state is changed
		this.updatePlayerDisplay();
		this.updateEnemyDisplay();

		return sleep(300);
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

		// Get source coordinates for MP cost popup
		const coords = this.getTargetCoordinates(outcome.sourceId);
		if (coords) {
			// Create MP cost popup
			new Popup(this, coords.x, coords.y, {
				type: "MpChange",
				delta: -outcome.amount,
				isCritical: false,
			});

			// Add burst animation with blue tint for MP
			this.addPredefinedAnim("burst", coords.x, coords.y);
		}

		// Update displays to show MP changes
		this.updatePlayerDisplay();

		return sleep(150);
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

		// Get target coordinates for effects
		const coords = this.getTargetCoordinates(outcome.targetId);

		// The state is already updated by the stateManager, so we just log and animate.
		switch (outcome.status) {
			case "death":
				console.log(`${target.name} has been defeated!`);
				if (coords) {
					// Make the character's sprite flash and fade out for death
					if (target.isPlayer) {
						const characterBounds =
							this.allyStatusPanel?.getCharacterSectionBounds(target.id);
						if (characterBounds) {
							const deathFlash = this.add.graphics();
							deathFlash.fillStyle(Palette.RED.num, 0.7);
							deathFlash.fillRectShape(characterBounds);
							deathFlash.setDepth(200);
							this.tweens.add({
								targets: deathFlash,
								alpha: { from: 0.7, to: 0 },
								duration: 600,
								onComplete: () => deathFlash.destroy(),
							});
						}
					} else {
						const enemyIndex = this.stateManager
							.getEnemyParty()
							.findIndex((e) => e.id === target.id);
						if (enemyIndex !== -1 && this.enemySprites[enemyIndex]) {
							this.tweens.add({
								targets: this.enemySprites[enemyIndex],
								alpha: { from: 1, to: 0.3 },
								duration: 600,
							});
						}
					}
				}
				break;
			case "defend":
				console.log(`${target.name} takes a defensive stance!`);
				if (coords) {
					// Add shield_gain animation for defend status
					this.addPredefinedAnim("shield_gain", coords.x, coords.y);
				}
				break;
		}

		return sleep(400);
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
		return sleep(100);
	}

	/**
	 * Get the screen coordinates for a character (for popups and animations)
	 */
	private getTargetCoordinates(
		characterId: string,
	): { x: number; y: number } | null {
		console.log(
			`[getTargetCoordinates] CALLED with characterId: ${characterId}`,
		);

		try {
			const character = this.stateManager.findCharacterById(characterId);
			if (!character) {
				console.warn(
					`[getTargetCoordinates] Character not found: ${characterId}`,
				);
				return null;
			}

			if (character.isPlayer) {
				// For allies, get center point from allyStatusPanel bounds
				const characterBounds = this.allyStatusPanel?.getCharacterSectionBounds(
					character.id,
				);
				if (characterBounds) {
					const coords = {
						x: characterBounds.x + characterBounds.width / 2,
						y: characterBounds.y + characterBounds.height / 2,
					};
					console.log(
						`[getTargetCoordinates] Player coords for ${character.name}:`,
						coords,
					);
					return coords;
				}
				console.warn(
					`[getTargetCoordinates] Could not get bounds for player: ${character.name}`,
				);
			} else {
				// For enemies, get position from enemySprites
				const enemyIndex = this.stateManager
					.getEnemyParty()
					.findIndex((e) => e.id === character.id);
				if (enemyIndex !== -1 && this.enemySprites[enemyIndex]) {
					const coords = {
						x: this.enemySprites[enemyIndex].x,
						y: this.enemySprites[enemyIndex].y,
					};
					console.log(
						`[getTargetCoordinates] Enemy coords for ${character.name}:`,
						coords,
					);
					return coords;
				}
				console.warn(
					`[getTargetCoordinates] Could not get sprite for enemy: ${character.name}`,
				);
			}

			return null;
		} catch (error) {
			console.error(`[getTargetCoordinates] Exception:`, error);
			return null;
		}
	}

	private finishResolution() {
		console.log("Finishing resolution phase...");
		this.stateManager.setResolvingActions(false);

		// Clear all character highlighting after resolution
		this.clearActiveCharacterVisuals();
		this.allyStatusPanel?.setActiveCharacter(null);

		// Check for battle end conditions
		if (this.checkBattleEnd()) {
			return;
		}

		// Start next turn with a brief delay for visual feedback
		this.time.delayedCall(1000, () => {
			console.log("Starting next turn...");
			this.startNextTurn();
		});
	}

	private updatePlayerDisplay() {
		// Update the ally status panel with current character data
		if (this.allyStatusPanel) {
			this.allyStatusPanel.setCharacters(this.stateManager.getPlayerParty());
			this.allyStatusPanel.updateDisplay();
		}
	}

	private updateEnemyDisplay() {
		this.stateManager.getEnemyParty().forEach((enemy, index) => {
			const { currentHP } = enemy;
			const hpBar = this.enemyHPBars[index];
			if (hpBar) {
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

	/**
	 * Handler for topic events - highlights the active character and displays subject banner
	 */
	private async onTopic(outcome: {
		type: "topic";
		characterId: string;
		subject?: string;
	}): Promise<void> {
		// First, pause 300ms with nothing happening at all
		await sleep(300);

		const character = this.stateManager.findCharacterById(outcome.characterId);
		if (character) {
			console.log(`Topic: ${character.name} is now active`);
			this.updateActiveCharacterVisuals(character);

			// Display subject in banner if provided
			if (outcome.subject && this.subjectBanner) {
				this.subjectBanner.setSubject(outcome.subject);
			}
		}

		// No additional delay after displaying
		return Promise.resolve();
	}

	/**
	 * Handler for turn end events - signals the end of resolution
	 */
	private async onTurnEnd(_outcome: { type: "turn_end" }): Promise<void> {
		console.log("Turn resolution complete");

		// Clear active character highlighting
		this.clearActiveCharacterVisuals();
		this.allyStatusPanel?.setActiveCharacter(null);

		// Hide the narrative log after a delay
		setTimeout(() => {
			this.narrativeLog?.hide();
		}, 2000);

		// Small delay before finishing resolution
		return sleep(500);
	}

	update(time: number, delta: number): void {
		super.update(time, delta);

		if (this.backgroundShader) {
			// The time property is a setter that expects ms
			this.backgroundShader.time = time;
		}
	}
}
