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

		this.turnOrder = [...this.playerParty, ...this.enemyParty]
			.filter((char) => char.isAlive)
			.sort((a, b) => b.speed - a.speed);
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
			new TextBlock(this, {
				x: 30,
				y: yOffset,
				text: character.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});

			// HP Bar
			const hpBar = new ProgressBar(this, {
				x: 30,
				y: yOffset + 15,
				width: 120,
				height: 6,
				value: character.currentHP,
				maxValue: character.maxHP,
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
				value: character.currentMP,
				maxValue: character.maxMP,
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
			// Placeholder enemy sprite
			const enemySprite = this.add.graphics();
			enemySprite.fillStyle(Palette.DARK_RED.num);
			enemySprite.fillRect(300, yOffset, 40, 40);
			enemySprite.lineStyle(2, Palette.WHITE.num);
			enemySprite.strokeRect(300, yOffset, 40, 40);

			new TextBlock(this, {
				x: 350,
				y: yOffset + 10,
				text: enemy.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE.hex,
			});

			// Enemy HP Bar
			const enemyHpBar = new ProgressBar(this, {
				x: 350,
				y: yOffset + 25,
				width: 60,
				height: 6,
				value: enemy.currentHP,
				maxValue: enemy.maxHP,
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
					const availableSkills = this.availableSkills.filter(
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
	
	private showActionMenu(state: BattleFocusState & { id: 'actionMenu' }) {
		this.actionMenu?.getWindow().fadeIn({ duration: 300 });
		this.actionMenu?.setVisible(true);
	}

	private hideActionMenu() {
		this.actionMenu?.setVisible(false);
		this.actionMenu?.getWindow().fadeOut({ duration: 300 });
	}
	
	private createSkillMenu(): Menu {
		this.skillMenu = new Menu(this, {
			x: 50,
			y: 80,
			width: 200,
			items: [], // Items are set dynamically in showSkillMenu
			onCancel: () => this.focusManager.sendEvent({ type: "back" }),
		});
		this.skillMenu.setVisible(false);
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
		const height = Math.min(120, skillItems.length * 25 + 40);
		this.skillMenu?.getWindow().resize(200, height);
		this.skillMenu?.getWindow().fadeIn({ duration: 300 });
		
		this.skillMenu?.setItems(skillItems);
		this.skillMenu?.setVisible(true);
	}

	private hideSkillMenu() {
		this.skillMenu?.setVisible(false);
		this.skillMenu?.getWindow().fadeOut({ duration: 300 });
	}

	private createTargetMenu(): Menu {
		this.targetMenu = new Menu(this, {
			x: 100,
			y: 50,
			width: 200,
			items: [], // Set dynamically
			onCancel: () => this.focusManager.sendEvent({ type: "back" }),
		});
		this.targetMenu.setVisible(false);
		return this.targetMenu;
	}

	private showTargetMenu(state: BattleFocusState & { id: 'targetMenu' }) {
		const { pendingAction } = state;
		
		// Determine which characters are valid targets
		let potentialTargets: Character[] = [];
		const skill = pendingAction.skillId
			? this.availableSkills.find((s) => s.id === pendingAction.skillId)
			: null;

		if (pendingAction.type === 'attack' || (skill && skill.damage)) {
			potentialTargets = this.enemyParty.filter((e) => e.isAlive);
		} else if (skill && skill.healing) {
			potentialTargets = this.playerParty.filter((p) => p.isAlive);
		}
		
		const targetItems: MenuItem[] = potentialTargets.map((target) => ({
			text: `${target.name} (${target.currentHP}/${target.maxHP} HP)`,
			onSelect: () => this.selectTarget(target.id),
		}));

		targetItems.push({
			text: "Back",
			onSelect: () => this.focusManager.sendEvent({ type: "back" }),
		});

		// Dynamically resize window and fade in
		const height = Math.min(120, targetItems.length * 25 + 40);
		this.targetMenu?.getWindow().resize(200, height);
		this.targetMenu?.getWindow().fadeIn({ duration: 300 });
		
		this.targetMenu?.setItems(targetItems);
		this.targetMenu?.setVisible(true);
	}

	private hideTargetMenu() {
		this.targetMenu?.setVisible(false);
		this.targetMenu?.getWindow().fadeOut({ duration: 300 });
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
		const livingPlayers = this.playerParty.filter((p) => p.isAlive);
		const randomTarget =
			livingPlayers[Math.floor(Math.random() * livingPlayers.length)];

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
		switch (action.type) {
			case ActionType.ATTACK:
				this.executeAttack(character);
				break;
			case ActionType.DEFEND:
				console.log(`${character.name} defends!`);
				break;
			case ActionType.SKILL:
				this.executeSkill(character, action.skillId!);
				break;
			case ActionType.ITEM:
				console.log(`${character.name} uses an item!`);
				break;
		}
	}

	private executeAttack(character: Character) {
		const damage = Math.floor(Math.random() * 30) + 10;
		const action = character.selectedAction!;

		if (action.targetId) {
			// Find the specific target
			const allCharacters = [...this.playerParty, ...this.enemyParty];
			const target = allCharacters.find((c) => c.id === action.targetId);

			if (target) {
				target.currentHP = Math.max(0, target.currentHP - damage);

				if (target.currentHP <= 0) {
					target.isAlive = false;
				}

				console.log(
					`${character.name} attacks ${target.name} for ${damage} damage!`,
				);
				this.updatePlayerDisplay();
				this.updateEnemyDisplay();
			}
		} else {
			// Fallback to random target (for enemies without target selection)
			if (character.isPlayer) {
				const livingEnemies = this.enemyParty.filter((e) => e.isAlive);
				const target =
					livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
				target.currentHP = Math.max(0, target.currentHP - damage);

				if (target.currentHP <= 0) {
					target.isAlive = false;
				}

				console.log(
					`${character.name} attacks ${target.name} for ${damage} damage!`,
				);
				this.updateEnemyDisplay();
			} else {
				const livingPlayers = this.playerParty.filter((p) => p.isAlive);
				const target =
					livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
				target.currentHP = Math.max(0, target.currentHP - damage);

				if (target.currentHP <= 0) {
					target.isAlive = false;
				}

				console.log(
					`${character.name} attacks ${target.name} for ${damage} damage!`,
				);
				this.updatePlayerDisplay();
			}
		}
	}

	private executeSkill(character: Character, skillId: string) {
		const skill = this.availableSkills.find((s) => s.id === skillId);
		if (!skill) return;

		character.currentMP -= skill.mpCost;
		const action = character.selectedAction!;

		if (action.targetId) {
			// Find the specific target
			const allCharacters = [...this.playerParty, ...this.enemyParty];
			const target = allCharacters.find((c) => c.id === action.targetId);

			if (target) {
				if (skill.damage) {
					target.currentHP = Math.max(0, target.currentHP - skill.damage);

					if (target.currentHP <= 0) {
						target.isAlive = false;
					}

					console.log(
						`${character.name} casts ${skill.name} on ${target.name} for ${skill.damage} damage!`,
					);
				} else if (skill.healing) {
					target.currentHP = Math.min(
						target.maxHP,
						target.currentHP + skill.healing,
					);
					console.log(
						`${character.name} casts ${skill.name} on ${target.name} for ${skill.healing} healing!`,
					);
				}
			}
		} else {
			// Fallback to random target (shouldn't happen with new system)
			if (skill.damage) {
				const livingEnemies = this.enemyParty.filter((e) => e.isAlive);
				const target =
					livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
				target.currentHP = Math.max(0, target.currentHP - skill.damage);

				if (target.currentHP <= 0) {
					target.isAlive = false;
				}

				console.log(
					`${character.name} casts ${skill.name} on ${target.name} for ${skill.damage} damage!`,
				);
			} else if (skill.healing) {
				const livingPlayers = this.playerParty.filter(
					(p) => p.isAlive && p.currentHP < p.maxHP,
				);
				if (livingPlayers.length > 0) {
					const target =
						livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
					target.currentHP = Math.min(
						target.maxHP,
						target.currentHP + skill.healing,
					);
					console.log(
						`${character.name} casts ${skill.name} on ${target.name} for ${skill.healing} healing!`,
					);
				}
			}
		}

		this.updatePlayerDisplay();
		this.updateEnemyDisplay();
	}

	private updatePlayerDisplay() {
		this.playerParty.forEach((character, index) => {
			if (this.playerHPBars[index]) {
				this.playerHPBars[index].setValue(character.currentHP, true);
			}
			if (this.playerMPBars[index]) {
				this.playerMPBars[index].setValue(character.currentMP, true);
			}
		});
	}

	private updateEnemyDisplay() {
		this.enemyParty.forEach((enemy, index) => {
			if (this.enemyHPBars[index]) {
				this.enemyHPBars[index].setValue(enemy.currentHP, true);
			}
		});
	}

	private checkBattleEnd(): boolean {
		const livingPlayers = this.playerParty.filter((p) => p.isAlive);
		const livingEnemies = this.enemyParty.filter((e) => e.isAlive);

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
		this.turnOrder = [...this.playerParty, ...this.enemyParty]
			.filter((char) => char.isAlive)
			.sort((a, b) => b.speed - a.speed);
		
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
