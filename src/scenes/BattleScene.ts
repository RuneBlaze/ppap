import { Palette } from "../palette";
import { Menu, type MenuItem } from "../ui/components/Menu";
import { AllyStatusPanel, type Character } from "../ui/components/AllyStatusPanel";
import { ProgressBar } from "../ui/primitives/ProgressBar";
import { TextBlock } from "../ui/primitives/TextBlock";
import { Window } from "../ui/primitives/Window";
import { FocusableMenu } from "../ui/state/SimpleFocusableWrappers";
import { GenericFocusStateMachine } from "../ui/state/GenericFocusStateMachine";
import { battleFocusConfig, type BattleFocusState, type BattleFocusEvent } from "./BattleFocusConfig";
import { BaseScene } from "./BaseScene";
import { match } from "ts-pattern";
import { filter, pipe, sample, sort } from "remeda";
import { BattleSprite } from "../base/BattleSprite";


export enum ActionType {
	ATTACK = "attack",
	DEFEND = "defend",
	SKILL = "skill",
	ITEM = "item",
}

export interface BattleCharacter extends Character {
	speed: number;
	isPlayer: boolean;
	selectedAction?: BattleAction;
}

export interface BattleAction {
	type: ActionType;
	skillId?: string;
	itemId?: string;
	targetId?: string;
	damage?: number;
	healing?: number;
}

export interface Skill {
	id: string;
	name: string;
	mpCost: number;
	damage?: number;
	healing?: number;
	description: string;
}

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
	private focusManager!: GenericFocusStateMachine<BattleFocusState, BattleFocusEvent>;
	// Character data
	private playerParty: BattleCharacter[] = [];
	private enemyParty: BattleCharacter[] = [];
	private turnOrder: BattleCharacter[] = [];
	private turnIndex: number = 0;

	// UI elements
	private actionMenu: Menu | null = null;
	private skillMenu: Menu | null = null;
	private targetMenu: Menu | null = null;

	// Character display elements
	private allyStatusPanel: AllyStatusPanel | null = null;
	private enemyHPBars: ProgressBar[] = [];
	private enemySprites: BattleSprite[] = [];
	private activePlayerIndicator: Phaser.GameObjects.Graphics | null = null;

	// Layout helpers
	private playerWindowY: number = 0; // populated in createCharacterDisplay

	// Debug
	private debugGraphics: Phaser.GameObjects.Graphics | null = null;
	private debugComponentIndex = -1; // -1 is off
	private debugComponents: { name: string; getBounds: () => Phaser.Geom.Rectangle }[] =
		[];

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
		super("BattleScene");
	}

	protected preloadSceneAssets() {
		// Assets are preloaded in BaseScene
		if (!this.textures.exists("enemies")) {
			this.load.spritesheet("enemies", "src/assets/enemies.png", {
				frameWidth: 64,
				frameHeight: 64,
			});
		}
		if (!this.textures.exists("portrait")) {
			this.load.image("portrait", "src/assets/portrait.png");
		}
	}

	protected createScene() {
		this.initializeBattleData();
		this.createUI();
		this.initializeFocusManager(); // Must be after UI is created
		this.initializeDebugComponents(); // Must be after UI is created
		this.startBattle();

		this.time.addEvent({
			delay: 2000,
			callback: () => {
				this.addPredefinedAnim("confetti_left", 213, 120);
			},
			loop: true,
		});

		this.activePlayerIndicator = this.add.graphics().setDepth(900);
	}

	private initializeFocusManager() {
		this.focusManager = new GenericFocusStateMachine(this, battleFocusConfig);

		this.focusManager.on(
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
					(event.event.type === "confirmAction" ||
						event.event.type === "selectTarget")
				) {
					this.turnIndex++;
					this.processNextCharacter();
					this.activePlayerIndicator?.setVisible(false);
				}

				if (event.newState.id === "actionMenu") {
					this.updateActivePlayerVisuals(event.newState.character);
				}
			},
		);

		// Register components and their lifecycle hooks
		this.focusManager.registerComponent(
			'actionMenu',
			new FocusableMenu(this.createActionMenu()),
			(state) => this.showActionMenu(state as BattleFocusState & { id: 'actionMenu' }),
			() => this.hideActionMenu()
		);

		this.focusManager.registerComponent(
			'skillMenu',
			new FocusableMenu(this.createSkillMenu()),
			(state) => this.showSkillMenu(state as BattleFocusState & { id: 'skillMenu' }),
			() => this.hideSkillMenu()
		);
		
		this.focusManager.registerComponent(
			'targetMenu',
			new FocusableMenu(this.createTargetMenu()),
			(state) => this.showTargetMenu(state as BattleFocusState & { id: 'targetMenu' }),
			() => this.hideTargetMenu()
		);

	}

	private updateActivePlayerVisuals(character: BattleCharacter) {
		// Update the ally status panel to show the active character
		this.allyStatusPanel?.setActiveCharacter(character.id);

		const playerIndex = this.playerParty.findIndex((p) => p.id === character.id);
		if (playerIndex === -1) {
			return;
		}

		const playerSectionWidth = 64; // Fixed width of 64px per character
		const sectionX = OUTER_MARGIN + playerIndex * playerSectionWidth;

		// Get the anchor point for menus (center of the player's section)
		const anchorX = sectionX + playerSectionWidth / 2;

		// 2. Update Action Menu position
		if (this.actionMenu) {
			const menuWindow = this.actionMenu.getWindow();
			const menuWidth = menuWindow.getWidth();
			const menuHeight = menuWindow.getHeight();
			const menuX = anchorX - menuWidth / 2;
			const menuY = this.playerWindowY - menuHeight - VERTICAL_SPACING;

			this.actionMenu.setPosition(
				Phaser.Math.Clamp(
					menuX,
					OUTER_MARGIN,
					SCENE_WIDTH - OUTER_MARGIN - menuWidth,
				),
				menuY,
			);
		}

		// 3. Update Skill Menu position
		if (this.skillMenu) {
			const menuWindow = this.skillMenu.getWindow();
			const menuWidth = menuWindow.getWidth();
			const menuHeight = menuWindow.getHeight();
			const menuX = anchorX - menuWidth / 2;
			const menuY = this.playerWindowY - menuHeight - VERTICAL_SPACING;

			this.skillMenu.setPosition(
				Phaser.Math.Clamp(
					menuX,
					OUTER_MARGIN,
					SCENE_WIDTH - OUTER_MARGIN - menuWidth,
				),
				menuY,
			);
		}
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

		// --- Action Menu ---
		this.debugComponents.push({
			name: "Action Menu",
			getBounds: () => {
				if (!this.actionMenu) return new Phaser.Geom.Rectangle(0, 0, 0, 0);
				const menuWindow = this.actionMenu.getWindow();
				return new Phaser.Geom.Rectangle(
					this.actionMenu.x,
					this.actionMenu.y,
					menuWindow.getWidth(),
					menuWindow.getHeight(),
				);
			},
		});

		// Register key listener
		this.input.keyboard?.on("keydown-D", this.cycleDebugHighlight, this);
	}

	private cycleDebugHighlight() {
		if (!this.debugGraphics) return;

		this.debugComponentIndex = (this.debugComponentIndex + 1) % (this.debugComponents.length + 1);

		this.debugGraphics.clear();

		if (this.debugComponentIndex >= this.debugComponents.length) {
			// This is the "off" state
			console.log("Debug highlight OFF");
			return;
		}

		const component = this.debugComponents[this.debugComponentIndex];
		const bounds = component.getBounds();

		console.log(`Debug highlight: ${component.name}`);

		this.debugGraphics.fillStyle(Palette.YELLOW.num, 0.3);
		this.debugGraphics.fillRectShape(bounds);
		this.debugGraphics.lineStyle(2, Palette.YELLOW.num);
		this.debugGraphics.strokeRectShape(bounds);
	}

	private initializeBattleData() {
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

		this.turnOrder = pipe(
			[...this.playerParty, ...this.enemyParty],
			filter((char) => char.isAlive),
			sort((a, b) => b.speed - a.speed),
		);
		this.turnIndex = 0;

	}

	private createUI() {
		// Create main battle UI layout
		this.createBattleLayout();
		this.createCharacterDisplay();
	}

	private createBattleLayout() {
		// Battle background
		const graphics = this.add.graphics();
		graphics.fillStyle(Palette.BLUE.num);
		graphics.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

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
		/* ---------------- Enemy Window -------------------------------------- */
		const enemyWindowX = OUTER_MARGIN;
		const enemyWindowY = OUTER_MARGIN;
		new Window(this, {
			x: enemyWindowX,
			y: enemyWindowY,
			width: WINDOW_WIDTH,
			height: ENEMY_WINDOW_HEIGHT,
		});

		const enemySectionWidth = WINDOW_WIDTH / this.enemyParty.length;
		this.enemyParty.forEach((enemy, index) => {
			const sectionStartX = enemyWindowX + enemySectionWidth * index;
			const centerX = sectionStartX + enemySectionWidth / 2;

			// Use BattleSprite instead of placeholder graphics
			const spriteX = centerX;
			const spriteY = enemyWindowY + 30;

			// From pineapple-pen/assets/enemies.json: goblin is 18, orc is not in this sheet. Use 2.
			const frame = enemy.name === "Goblin" ? 18 : 2;
			const enemySprite = new BattleSprite(this, spriteX, spriteY, "enemies", frame);
			enemySprite.setScale(PORTRAIT_SIZE / 64); // Scale down 64x64 sprite
			this.enemySprites.push(enemySprite);

			// Name label (roughly centred)
			new TextBlock(this, {
				x: centerX - (enemy.name.length * 4),
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
		const playerWindowY = SCENE_HEIGHT - OUTER_MARGIN - PLAYER_WINDOW_HEIGHT - 30;
		this.playerWindowY = playerWindowY; // expose for other UI elements

		// Create the ally status panel component
		this.allyStatusPanel = new AllyStatusPanel(this, {
			x: OUTER_MARGIN,
			y: playerWindowY,
			width: WINDOW_WIDTH,
			height: PLAYER_WINDOW_HEIGHT,
			characters: this.playerParty,
		});
		this.allyStatusPanel.create();
	}

	private startBattle() {
		this.processNextCharacter();
	}

	private processNextCharacter() {
		if (this.turnIndex >= this.turnOrder.length) {
			// All characters have acted, resolve actions
			this.resolveActions();
			return;
		}

		const currentCharacter = this.turnOrder[this.turnIndex];

		if (currentCharacter.isPlayer) {
			// Player turn is now started by sending an event to the FSM
			this.focusManager.sendEvent({ type: 'startPlayerTurn', character: currentCharacter });
		} else {
			this.processEnemyAction(currentCharacter);
		}
	}

	// =========================================================================
	// Menu Creation, Show, and Hide Logic
	// Driven by FSM onEnter/onExit hooks now
	// =========================================================================

	private createActionMenu(): Menu {
		const ACTION_MENU_WIDTH = 120;

		const actionItems: MenuItem[] = [
			{
				text: "Attack",
				onSelect: () => this.focusManager.sendEvent({ type: "selectAttack" }),
			},
			{
				text: "Defend",
				onSelect: () => {
					// Defend is a complete action, no target needed.
					// The scene will handle the logic, then tell the FSM the action is confirmed.
					const character = (this.focusManager.getCurrentState() as any).character;
					this.selectAction(character, { type: ActionType.DEFEND });
				},
			},
			{
				text: "Skills",
				onSelect: () => {
					const character = (this.focusManager.getCurrentState() as any).character;
					const availableSkills = filter(this.availableSkills, 
						(skill) => character.currentMP >= skill.mpCost,
					);
					this.focusManager.sendEvent({ type: "selectSkill", skills: availableSkills });
				},
			},
			{
				text: "Items",
				onSelect: () => this.focusManager.sendEvent({ type: "selectItem" }),
			},
		];

		this.actionMenu = new Menu(this, {
			x: 0,
			y: 0,
			width: ACTION_MENU_WIDTH,
			items: actionItems,
			onCancel: () => this.focusManager.sendEvent({ type: "cancel" }),
		});
		this.actionMenu.setVisible(false);
		return this.actionMenu;
	}

	private toggleMenuVisibility(menu: Menu | null, isVisible: boolean) {
		if (!menu) return;
		const window = menu.getWindow();
		if (isVisible) {
			window.fadeIn({ duration: 300 });
			menu.setVisible(true);
		} else {
			menu.setVisible(false);
			window.fadeOut({ duration: 300 });
		}
	}
	
	private showActionMenu(_state: BattleFocusState & { id: "actionMenu" }) {
		this.toggleMenuVisibility(this.actionMenu, true);
	}

	private hideActionMenu() {
		this.toggleMenuVisibility(this.actionMenu, false);
	}
	
	private createSkillMenu(): Menu {
		this.skillMenu = new Menu(this, {
			x: 0,
			y: 0,
			width: 200,
			items: [], // Items are set dynamically in showSkillMenu
			onCancel: () => this.focusManager.sendEvent({ type: "back" }),
		});
		return this.skillMenu;
	}

	private showSkillMenu(state: BattleFocusState & { id: "skillMenu" }) {
		const skillItems: MenuItem[] = state.skills.map((skill) => ({
			text: `${skill.name} (${skill.mpCost} MP)`,
			onSelect: () => {
				this.focusManager.sendEvent({
					type: "selectAttack", // In the config, this means "action that needs a target"
					skillId: skill.id,
				} as any); // cast because skillId is not on base event
			},
		}));

		skillItems.push({
			text: "Back",
			onSelect: () => this.focusManager.sendEvent({ type: "back" }),
		});

		this.skillMenu?.setItems(skillItems);
		// Dynamically resize window based on content
		const height = this.calculateMenuHeight(skillItems.length);
		this.skillMenu?.getWindow().resize(200, height);
		this.toggleMenuVisibility(this.skillMenu, true);
	}

	private hideSkillMenu() {
		this.toggleMenuVisibility(this.skillMenu, false);
	}

	private createTargetMenu(): Menu {
		this.targetMenu = new Menu(this, {
			x: 100,
			y: 50,
			width: 200,
			items: [], // Set dynamically
			onCancel: () => this.focusManager.sendEvent({ type: "back" }),
		});
		return this.targetMenu;
	}

	private showTargetMenu(state: BattleFocusState & { id: "targetMenu" }) {
		const { pendingAction } = state;
		
		// Determine which characters are valid targets
		const skill = pendingAction.skillId
			? this.availableSkills.find((s) => s.id === pendingAction.skillId)
			: null;

		const potentialTargets = match(pendingAction.type)
			.with(ActionType.ATTACK, () => filter(this.enemyParty, (e) => e.isAlive))
			.with(ActionType.SKILL, () => {
				if (skill?.damage) {
					return filter(this.enemyParty, (e) => e.isAlive);
				}
				if (skill?.healing) {
					return filter(this.playerParty, (p) => p.isAlive);
				}
				return [] as BattleCharacter[];
			})
			.otherwise(() => [] as BattleCharacter[]);
		
		const targetItems: MenuItem[] = potentialTargets.map((target) => ({
			text: `${target.name} (${target.currentHP}/${target.maxHP} HP)`,
			onSelect: () => this.selectTarget(target.id),
		}));

		targetItems.push({
			text: "Back",
			onSelect: () => this.focusManager.sendEvent({ type: "back" }),
		});

		this.targetMenu?.setItems(targetItems);
		// Dynamically resize window and fade in
		const height = this.calculateMenuHeight(targetItems.length);
		this.targetMenu?.getWindow().resize(200, height);
		this.toggleMenuVisibility(this.targetMenu, true);
	}

	private hideTargetMenu() {
		this.toggleMenuVisibility(this.targetMenu, false);
	}

	private selectTarget(targetId: string) {
		const currentState = this.focusManager.getCurrentState() as any;
		if (currentState.pendingAction) {
			const completeAction: BattleAction = {
				...currentState.pendingAction,
				targetId,
			} as BattleAction;

			this.selectAction(currentState.character, completeAction);
		}
	}

	private selectAction(character: BattleCharacter, action: BattleAction) {
		character.selectedAction = action;

		// Tell the FSM the action is done. The stateChanged listener will handle advancing the turn.
		this.focusManager.sendEvent({ type: 'confirmAction', action });
	}

	private processEnemyAction(character: BattleCharacter) {
		// Simple AI: enemies always attack a random player
		const randomTarget = pipe(
			this.playerParty,
			filter((p) => p.isAlive),
			sample(1),
		)[0];

		if (!randomTarget) {
			console.warn("No living players for enemy to target.");
			this.turnIndex++;
			this.processNextCharacter();
			return;
		}

		character.selectedAction = {
			type: ActionType.ATTACK,
			targetId: randomTarget.id,
		};

		// Move to next character
		this.turnIndex++;
		this.processNextCharacter();
	}

	private resolveActions() {
		console.log("Resolving all actions...");

		// Process all selected actions
		this.turnOrder.forEach((character) => {
			if (character.selectedAction && character.isAlive) {
				this.executeAction(character, character.selectedAction);
			}
		});

		// Check for battle end conditions
		if (this.checkBattleEnd()) {
			return;
		}

		// Start next turn
		this.startNextTurn();
	}

	private executeAction(character: BattleCharacter, action: BattleAction) {
		match(action.type)
			.with(ActionType.ATTACK, () => this.executeAttack(character))
			.with(ActionType.DEFEND, () => console.log(`${character.name} defends!`))
			.with(ActionType.SKILL, () => this.executeSkill(character, action.skillId!))
			.with(ActionType.ITEM, () => console.log(`${character.name} uses an item!`))
			.exhaustive();
	}

	private findCharacterById(id: string): BattleCharacter | undefined {
		const allCharacters = [...this.playerParty, ...this.enemyParty];
		return allCharacters.find((c) => c.id === id);
	}

	private executeAttack(character: BattleCharacter) {
		const damage = Math.floor(Math.random() * 30) + 10;
		const action = character.selectedAction!;

		const target = this.findCharacterById(action.targetId!); // targetId is guaranteed to be set now

		if (target) {
			this.handleCharacterDamage(target, damage);

			console.log(
				`${character.name} attacks ${target.name} for ${damage} damage!`,
			);
			this.updatePlayerDisplay();
			this.updateEnemyDisplay();
		}
	}

	private handleCharacterDamage(character: BattleCharacter, damage: number) {
		character.currentHP = Math.max(0, character.currentHP - damage);
		if (character.currentHP <= 0) {
			character.isAlive = false;
		}
	}

	private executeSkill(character: BattleCharacter, skillId: string) {
		const skill = this.availableSkills.find((s) => s.id === skillId);
		if (!skill) return;

		character.currentMP -= skill.mpCost;
		const action = character.selectedAction!;

		const target = this.findCharacterById(action.targetId!); // targetId is guaranteed to be set now

		if (target) {
			if (skill.damage) {
				this.handleCharacterDamage(target, skill.damage);

				console.log(
					`${character.name} casts ${skill.name} on ${target.name} for ${skill.damage} damage!`,
				);
			} else if (skill.healing) {
				this.handleCharacterHealing(target, skill.healing);
				console.log(
					`${character.name} casts ${skill.name} on ${target.name} for ${skill.healing} healing!`,
				);
			}
		}

		this.updatePlayerDisplay();
		this.updateEnemyDisplay();
	}

	private handleCharacterHealing(character: BattleCharacter, healing: number) {
		character.currentHP = Math.min(
			character.maxHP,
			character.currentHP + healing,
		);
	}

	private updatePlayerDisplay() {
		// Update the ally status panel with current character data
		this.allyStatusPanel?.setCharacters(this.playerParty);
		this.allyStatusPanel?.updateDisplay();
	}

	private updateEnemyDisplay() {
		this.enemyParty.forEach((enemy, index) => {
			const { currentHP } = enemy;
			if (this.enemyHPBars[index]) {
				this.enemyHPBars[index].setValue(currentHP, true);
			}
		});
	}

	private checkBattleEnd(): boolean {
		const livingPlayers = filter(this.playerParty, (p) => p.isAlive);
		const livingEnemies = filter(this.enemyParty, (e) => e.isAlive);

		if (livingPlayers.length === 0) {
			console.log("Game Over! All players defeated.");
			return true;
		}

		if (livingEnemies.length === 0) {
			console.log("Victory! All enemies defeated.");
			return true;
		}

		return false;
	}

	private startNextTurn() {
		// Clear all selected actions
		this.turnOrder.forEach((character) => {
			character.selectedAction = undefined;
		});

		// Recalculate turn order (in case characters died)
		this.turnOrder = pipe(
			[...this.playerParty, ...this.enemyParty],
			filter((char) => char.isAlive),
			sort((a, b) => b.speed - a.speed),
		);
		
		this.turnIndex = 0; // Reset for the new turn

		// Start new turn
		this.processNextCharacter();
	}


	private calculateMenuHeight(itemCount: number): number {
		return Math.min(120, itemCount * 25 + 40);
	}

	destroy() {
		if (this.focusManager) {
			this.focusManager.destroy();
		}

		// Clean up debug stuff
		this.input.keyboard?.off("keydown-D", this.cycleDebugHighlight, this);
		this.debugGraphics?.destroy();
		this.activePlayerIndicator?.destroy();

		// Clean up ally status panel
		this.allyStatusPanel?.destroy();
		this.allyStatusPanel = null;

		// Clean up arrays
		this.enemyHPBars = [];
		this.playerParty = [];
		this.enemyParty = [];
		this.turnOrder = [];
		this.enemySprites = [];
	}
}
