import { DrawUtils } from "../draw-utils";
import { Palette } from "../palette";
import { Menu, type MenuItem } from "../ui/components/Menu";
import { ProgressBar } from "../ui/primitives/ProgressBar";
import { TextBlock } from "../ui/primitives/TextBlock";
import { Window } from "../ui/primitives/Window";
import { FocusableMenu } from "../ui/state/SimpleFocusableWrappers";
import { GenericFocusStateMachine } from "../ui/state/GenericFocusStateMachine";
import { battleFocusConfig, type BattleFocusState, type BattleFocusEvent } from "./BattleFocusConfig";
import { BaseScene } from "./BaseScene";
import { match } from "ts-pattern";
import { filter, pipe, sample, sort } from "remeda";


export enum ActionType {
	ATTACK = "attack",
	DEFEND = "defend",
	SKILL = "skill",
	ITEM = "item",
}

export interface Character {
	id: string;
	name: string;
	maxHP: number;
	currentHP: number;
	maxMP: number;
	currentMP: number;
	speed: number;
	isPlayer: boolean;
	isAlive: boolean;
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

export class BattleScene extends BaseScene {
	private focusManager!: GenericFocusStateMachine<BattleFocusState, BattleFocusEvent>;
	// Character data
	private playerParty: Character[] = [];
	private enemyParty: Character[] = [];
	private turnOrder: Character[] = [];
	private turnIndex: number = 0;

	// UI elements
	private actionMenu: Menu | null = null;
	private skillMenu: Menu | null = null;
	private targetMenu: Menu | null = null;

	// Character display elements
	private playerHPBars: ProgressBar[] = [];
	private playerMPBars: ProgressBar[] = [];
	private enemyHPBars: ProgressBar[] = [];

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

	// Animation and popup space (removed for now)

	constructor() {
		super("BattleScene");
	}

	protected preloadSceneAssets() {
		DrawUtils.preloadAssets(this);
	}

	protected createScene() {
		this.initializeBattleData();
		this.createUI();
		this.initializeFocusManager(); // Must be after UI is created
		this.startBattle();
	}

	private initializeFocusManager() {
		this.focusManager = new GenericFocusStateMachine(this, battleFocusConfig);

		this.focusManager.on("stateChanged", (event: { oldState: BattleFocusState, newState: BattleFocusState, event: BattleFocusEvent }) => {
			console.log(
				`Focus state changed: ${event.oldState.id} → ${event.newState.id} via ${event.event.type}`,
			);

			// If we have just finished selecting an action and are now idle, advance the turn.
			if (event.newState.id === 'idle' && (event.event.type === 'confirmAction' || event.event.type === 'selectTarget')) {
				this.turnIndex++;
				this.processNextCharacter();
			}
		});

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

	private initializeBattleData() {
		// Initialize player party
		this.playerParty = [
			{
				id: "hero",
				name: "Hero",
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
				maxHP: 70,
				currentHP: 65,
				maxMP: 80,
				currentMP: 70,
				speed: 12,
				isPlayer: true,
				isAlive: true,
			},
		];

		// Initialize enemy party
		this.enemyParty = [
			{
				id: "goblin1",
				name: "Goblin",
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
		this.createMessageArea();
		this.createAnimationSpaces();
	}

	private createBattleLayout() {
		// Battle background
		const graphics = this.add.graphics();
		graphics.fillStyle(Palette.BLUE.num);
		graphics.fillRect(0, 0, 427, 240);

		// Add some basic battle environment
		new TextBlock(this, {
			x: 20,
			y: 20,
			text: "Battle Scene - Wolf RPG Style",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});
	}

	private createCharacterDisplay() {
		// Player party display (left side)
		new Window(this, {
			x: 20,
			y: 40,
			width: 180,
			height: 120,
		});

		let yOffset = 50;
		this.playerParty.forEach((character) => {
			const { name, currentHP, maxHP, currentMP, maxMP } = character;
			new TextBlock(this, {
				x: 30,
				y: yOffset,
				text: name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});

			// HP Bar
			const hpBar = new ProgressBar(this, {
				x: 30,
				y: yOffset + 15,
				width: 120,
				height: 6,
				value: currentHP,
				maxValue: maxHP,
				gradientStart: Palette.RED.hex,
				gradientEnd: Palette.RED.hex,
			});
			this.playerHPBars.push(hpBar);

			new TextBlock(this, {
				x: 160,
				y: yOffset + 15,
				text: "HP",
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});

			// MP Bar
			const mpBar = new ProgressBar(this, {
				x: 30,
				y: yOffset + 25,
				width: 120,
				height: 6,
				value: currentMP,
				maxValue: maxMP,
				gradientStart: Palette.BLUE.hex,
				gradientEnd: Palette.BLUE.hex,
			});
			this.playerMPBars.push(mpBar);

			new TextBlock(this, {
				x: 160,
				y: yOffset + 25,
				text: "MP",
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});

			yOffset += 40;
		});

		// Enemy party display (right side with placeholder art)
		yOffset = 50;
		this.enemyParty.forEach((enemy) => {
			const { name, currentHP, maxHP } = enemy;
			// Placeholder enemy sprite
			const enemySprite = this.add.graphics();
			enemySprite.fillStyle(Palette.DARK_RED.num);
			enemySprite.fillRect(300, yOffset, 40, 40);
			enemySprite.lineStyle(2, Palette.WHITE.num);
			enemySprite.strokeRect(300, yOffset, 40, 40);

			new TextBlock(this, {
				x: 350,
				y: yOffset + 10,
				text: name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});

			// Enemy HP Bar
			const enemyHpBar = new ProgressBar(this, {
				x: 350,
				y: yOffset + 25,
				width: 60,
				height: 6,
				value: currentHP,
				maxValue: maxHP,
				gradientStart: Palette.RED.hex,
				gradientEnd: Palette.RED.hex,
			});
			this.enemyHPBars.push(enemyHpBar);

			yOffset += 50;
		});
	}

	private createMessageArea() {
		// Message window for battle text
		new Window(this, {
			x: 20,
			y: 170,
			width: 387,
			height: 50,
		});

		new TextBlock(this, {
			x: 30,
			y: 185,
			text: "Battle started! Choose your action...",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});
	}

	private createAnimationSpaces() {
		// Animation containers removed for now
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
			x: 220,
			y: 100,
			width: 150,
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
	
	private showActionMenu(state: BattleFocusState & { id: 'actionMenu' }) {
		this.toggleMenuVisibility(this.actionMenu, true);
	}

	private hideActionMenu() {
		this.toggleMenuVisibility(this.actionMenu, false);
	}
	
	private createSkillMenu(): Menu {
		this.skillMenu = new Menu(this, {
			x: 50,
			y: 80,
			width: 200,
			items: [], // Items are set dynamically in showSkillMenu
			onCancel: () => this.focusManager.sendEvent({ type: "back" }),
		});
		return this.skillMenu;
	}

	private showSkillMenu(state: BattleFocusState & { id: 'skillMenu' }) {
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

	private showTargetMenu(state: BattleFocusState & { id: 'targetMenu' }) {
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
				return [] as Character[];
			})
			.otherwise(() => [] as Character[]);
		
		const targetItems: MenuItem[] = potentialTargets.map((target) => ({
			text: `${target.name} (${target.currentHP}/${target.maxHP} HP)`,
			onSelect: () => this.selectTarget(target.id),
		}));

		targetItems.push({
			text: "Back",
			onSelect: () => this.focusManager.sendEvent({ type: "back" }),
		});

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

	private selectAction(character: Character, action: BattleAction) {
		character.selectedAction = action;

		// Tell the FSM the action is done. The stateChanged listener will handle advancing the turn.
		this.focusManager.sendEvent({ type: 'confirmAction', action });
	}

	private processEnemyAction(character: Character) {
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

	private executeAction(character: Character, action: BattleAction) {
		match(action.type)
			.with(ActionType.ATTACK, () => this.executeAttack(character))
			.with(ActionType.DEFEND, () => console.log(`${character.name} defends!`))
			.with(ActionType.SKILL, () => this.executeSkill(character, action.skillId!))
			.with(ActionType.ITEM, () => console.log(`${character.name} uses an item!`))
			.exhaustive();
	}

	private findCharacterById(id: string): Character | undefined {
		const allCharacters = [...this.playerParty, ...this.enemyParty];
		return allCharacters.find((c) => c.id === id);
	}

	private executeAttack(character: Character) {
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

	private handleCharacterDamage(character: Character, damage: number) {
		character.currentHP = Math.max(0, character.currentHP - damage);
		if (character.currentHP <= 0) {
			character.isAlive = false;
		}
	}

	private executeSkill(character: Character, skillId: string) {
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

	private handleCharacterHealing(character: Character, healing: number) {
		character.currentHP = Math.min(
			character.maxHP,
			character.currentHP + healing,
		);
	}

	private updatePlayerDisplay() {
		this.playerParty.forEach((character, index) => {
			const { currentHP, currentMP } = character;
			if (this.playerHPBars[index]) {
				this.playerHPBars[index].setValue(currentHP, true);
			}
			if (this.playerMPBars[index]) {
				this.playerMPBars[index].setValue(currentMP, true);
			}
		});
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

	private hideAllMenus() {
		this.hideActionMenu();
		this.hideSkillMenu();
		this.hideTargetMenu();
		
		// Let the FSM know the turn is over, which should return it to 'idle'
		this.focusManager.sendEvent({ type: 'endTurn' });
	}

	private calculateMenuHeight(itemCount: number): number {
		return Math.min(120, itemCount * 25 + 40);
	}

	destroy() {
		if (this.focusManager) {
			this.focusManager.destroy();
		}

		// Clean up arrays
		this.playerHPBars = [];
		this.playerMPBars = [];
		this.enemyHPBars = [];
		this.playerParty = [];
		this.enemyParty = [];
		this.turnOrder = [];
	}
}
