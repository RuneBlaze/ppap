import { DrawUtils } from "../draw-utils";
import { Palette } from "../palette";
import { Menu, type MenuItem } from "../ui/components/Menu";
import { Container } from "../ui/layout/Container";
import { Button } from "../ui/primitives/Button";
import { ProgressBar } from "../ui/primitives/ProgressBar";
import { TextBlock } from "../ui/primitives/TextBlock";
import { Window } from "../ui/primitives/Window";
import { FocusableMenu } from "../ui/state/FocusableWrappers";
import { FocusManager, type FocusToken } from "../ui/state/FocusManager";
import { BaseScene } from "./BaseScene";

enum BattlePhase {
	SELECTING_ACTIONS = "selecting_actions",
	RESOLVING_ACTIONS = "resolving_actions",
	BATTLE_END = "battle_end",
}

enum ActionType {
	ATTACK = "attack",
	DEFEND = "defend",
	SKILL = "skill",
	ITEM = "item",
}

interface Character {
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

interface BattleAction {
	type: ActionType;
	skillId?: string;
	itemId?: string;
	targetId?: string;
	damage?: number;
	healing?: number;
}

interface Skill {
	id: string;
	name: string;
	mpCost: number;
	damage?: number;
	healing?: number;
	description: string;
}

export class BattleScene extends BaseScene {
	private focusManager: FocusManager | null = null;
	private currentPhase: BattlePhase = BattlePhase.SELECTING_ACTIONS;

	// Character data
	private playerParty: Character[] = [];
	private enemyParty: Character[] = [];
	private currentCharacterIndex: number = 0;
	private turnOrder: Character[] = [];
	private turnIndex: number = 0;

	// UI elements
	private actionMenu: Menu | null = null;
	private skillMenu: Menu | null = null;
	private targetMenu: Menu | null = null;
	private focusableActionMenu: FocusableMenu | null = null;
	private focusableSkillMenu: FocusableMenu | null = null;
	private focusableTargetMenu: FocusableMenu | null = null;
	private actionMenuToken: FocusToken | null = null;
	private skillMenuToken: FocusToken | null = null;
	private targetMenuToken: FocusToken | null = null;

	// Current action being built
	private pendingAction: Partial<BattleAction> | null = null;
	private currentActingCharacter: Character | null = null;

	// UI Windows
	private actionWindow: Window | null = null;
	private skillWindow: Window | null = null;
	private targetWindow: Window | null = null;
	private statusWindow: Window | null = null;
	private messageWindow: Window | null = null;

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

	// Animation and popup space
	private animationContainer: Container | null = null;
	private popupContainer: Container | null = null;

	constructor() {
		super("BattleScene");
	}

	protected preloadSceneAssets() {
		DrawUtils.preloadAssets(this);
	}

	protected createScene() {
		this.initializeFocusManager();
		this.initializeBattleData();
		this.createUI();
		this.startBattle();
	}

	private initializeFocusManager() {
		this.focusManager = new FocusManager(this);

		this.focusManager.on("focusChanged", (event: any) => {
			console.log(
				`[${event.layer}] Focus changed: ${event.oldName || "none"} → ${event.newName || "none"}`,
			);
		});
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
		graphics.fillStyle(Palette.DARK_BLUE);
		graphics.fillRect(0, 0, 427, 240);

		// Add some basic battle environment
		new TextBlock(this, {
			x: 20,
			y: 20,
			text: "Battle Scene - Wolf RPG Style",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});
	}

	private createCharacterDisplay() {
		// Player party display (left side)
		this.statusWindow = new Window(this, {
			x: 20,
			y: 40,
			width: 180,
			height: 120,
		});

		let yOffset = 50;
		this.playerParty.forEach((character, index) => {
			new TextBlock(this, {
				x: 30,
				y: yOffset,
				text: character.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE,
			});

			// HP Bar
			const hpBar = new ProgressBar(this, {
				x: 30,
				y: yOffset + 15,
				width: 120,
				height: 6,
				value: character.currentHP,
				maxValue: character.maxHP,
				gradientStart: Palette.RED,
				gradientEnd: Palette.RED,
			});
			this.playerHPBars.push(hpBar);

			new TextBlock(this, {
				x: 160,
				y: yOffset + 15,
				text: "HP",
				fontKey: "everydayStandard",
				color: Palette.WHITE,
			});

			// MP Bar
			const mpBar = new ProgressBar(this, {
				x: 30,
				y: yOffset + 25,
				width: 120,
				height: 6,
				value: character.currentMP,
				maxValue: character.maxMP,
				gradientStart: Palette.BLUE,
				gradientEnd: Palette.BLUE,
			});
			this.playerMPBars.push(mpBar);

			new TextBlock(this, {
				x: 160,
				y: yOffset + 25,
				text: "MP",
				fontKey: "everydayStandard",
				color: Palette.WHITE,
			});

			yOffset += 40;
		});

		// Enemy party display (right side with placeholder art)
		yOffset = 50;
		this.enemyParty.forEach((enemy, index) => {
			// Placeholder enemy sprite
			const enemySprite = this.add.graphics();
			enemySprite.fillStyle(Palette.DARK_RED);
			enemySprite.fillRect(300, yOffset, 40, 40);
			enemySprite.lineStyle(2, Palette.WHITE);
			enemySprite.strokeRect(300, yOffset, 40, 40);

			new TextBlock(this, {
				x: 350,
				y: yOffset + 10,
				text: enemy.name,
				fontKey: "everydayStandard",
				color: Palette.WHITE,
			});

			// Enemy HP Bar
			const enemyHpBar = new ProgressBar(this, {
				x: 350,
				y: yOffset + 25,
				width: 60,
				height: 6,
				value: enemy.currentHP,
				maxValue: enemy.maxHP,
				gradientStart: Palette.RED,
				gradientEnd: Palette.RED,
			});
			this.enemyHPBars.push(enemyHpBar);

			yOffset += 50;
		});
	}

	private createMessageArea() {
		// Message window for battle text
		this.messageWindow = new Window(this, {
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
			color: Palette.WHITE,
		});
	}

	private createAnimationSpaces() {
		// Container for battle animations
		this.animationContainer = new Container(this);

		// Container for popup messages
		this.popupContainer = new Container(this);
	}

	private startBattle() {
		this.calculateTurnOrder();
		this.currentPhase = BattlePhase.SELECTING_ACTIONS;
		this.currentCharacterIndex = 0;
		this.processNextCharacter();
	}

	private calculateTurnOrder() {
		// Combine all living characters and sort by speed
		const allCharacters = [...this.playerParty, ...this.enemyParty]
			.filter((char) => char.isAlive)
			.sort((a, b) => b.speed - a.speed);

		this.turnOrder = allCharacters;
		this.turnIndex = 0;
	}

	private processNextCharacter() {
		if (this.turnIndex >= this.turnOrder.length) {
			// All characters have acted, resolve actions
			this.currentPhase = BattlePhase.RESOLVING_ACTIONS;
			this.resolveActions();
			return;
		}

		const currentCharacter = this.turnOrder[this.turnIndex];

		if (currentCharacter.isPlayer) {
			this.showPlayerActionMenu(currentCharacter);
		} else {
			this.processEnemyAction(currentCharacter);
		}
	}

	private showPlayerActionMenu(character: Character) {
		this.hideAllMenus();

		// Push new focus layer for action menu
		this.focusManager?.pushLayer("actionMenu");

		// Create action window
		this.actionWindow = new Window(this, {
			x: 220,
			y: 100,
			width: 150,
			height: 100,
			transition: { type: "fade", duration: 300 },
		});

		const actionItems: MenuItem[] = [
			{
				text: "Attack",
				onSelect: () =>
					this.beginAction(character, { type: ActionType.ATTACK }),
			},
			{
				text: "Defend",
				onSelect: () =>
					this.selectAction(character, { type: ActionType.DEFEND }),
			},
			{
				text: "Skills",
				onSelect: () => this.showSkillMenu(character),
			},
			{
				text: "Items",
				onSelect: () => this.selectAction(character, { type: ActionType.ITEM }),
			},
		];

		this.actionMenu = new Menu(this, {
			x: 220,
			y: 100,
			width: 150,
			items: actionItems,
			onCancel: () => {
				// TODO: Allow going back to previous character if needed
				console.log("Action menu cancelled");
			},
		});

		this.focusableActionMenu = new FocusableMenu(this.actionMenu);
		this.actionMenuToken = this.focusManager!.register(
			"actionMenu",
			this.focusableActionMenu,
			"actionMenu",
		);
		this.focusManager?.focus(this.actionMenuToken);
	}

	private showSkillMenu(character: Character) {
		// Push new focus layer for skill menu
		this.focusManager?.pushLayer("skillMenu");

		// Create skill window
		this.skillWindow = new Window(this, {
			x: 50,
			y: 80,
			width: 200,
			height: 120,
			transition: { type: "fade", duration: 300 },
		});

		const skillItems: MenuItem[] = this.availableSkills
			.filter((skill) => character.currentMP >= skill.mpCost)
			.map((skill) => ({
				text: `${skill.name} (${skill.mpCost} MP)`,
				onSelect: () =>
					this.beginAction(character, {
						type: ActionType.SKILL,
						skillId: skill.id,
					}),
			}));

		// Add back option
		skillItems.push({
			text: "Back",
			onSelect: () => {
				this.hideSkillMenu();
				// Return focus to action menu
				if (this.actionMenuToken) {
					this.focusManager?.focus(this.actionMenuToken);
				}
			},
		});

		this.skillMenu = new Menu(this, {
			x: 50,
			y: 80,
			width: 200,
			items: skillItems,
			onCancel: () => {
				this.hideSkillMenu();
				// Return focus to action menu
				if (this.actionMenuToken) {
					this.focusManager?.focus(this.actionMenuToken);
				}
			},
		});

		this.focusableSkillMenu = new FocusableMenu(this.skillMenu);
		this.skillMenuToken = this.focusManager!.register(
			"skillMenu",
			this.focusableSkillMenu,
			"skillMenu",
		);
		this.focusManager?.focus(this.skillMenuToken);
	}

	private showTargetMenu(
		targets: Character[],
		targetType: "enemies" | "allies",
	) {
		// Push new focus layer for target menu
		this.focusManager?.pushLayer("targetMenu");

		// Create target window
		this.targetWindow = new Window(this, {
			x: 100,
			y: 50,
			width: 200,
			height: Math.min(120, targets.length * 25 + 40),
			transition: { type: "fade", duration: 300 },
		});

		const targetItems: MenuItem[] = targets.map((target) => ({
			text: `${target.name} (${target.currentHP}/${target.maxHP} HP)`,
			onSelect: () => this.selectTarget(target.id),
		}));

		// Add back option
		targetItems.push({
			text: "Back",
			onSelect: () => {
				this.hideTargetMenu();
				// Return focus to appropriate menu
				if (
					this.pendingAction?.type === ActionType.SKILL &&
					this.skillMenuToken
				) {
					this.focusManager?.focus(this.skillMenuToken);
				} else if (this.actionMenuToken) {
					this.focusManager?.focus(this.actionMenuToken);
				}
			},
		});

		this.targetMenu = new Menu(this, {
			x: 100,
			y: 50,
			width: 200,
			items: targetItems,
			onCancel: () => {
				this.hideTargetMenu();
				// Return focus to appropriate menu
				if (
					this.pendingAction?.type === ActionType.SKILL &&
					this.skillMenuToken
				) {
					this.focusManager?.focus(this.skillMenuToken);
				} else if (this.actionMenuToken) {
					this.focusManager?.focus(this.actionMenuToken);
				}
			},
		});

		this.focusableTargetMenu = new FocusableMenu(this.targetMenu);
		this.targetMenuToken = this.focusManager!.register(
			"targetMenu",
			this.focusableTargetMenu,
			"targetMenu",
		);
		this.focusManager?.focus(this.targetMenuToken);
	}

	private selectTarget(targetId: string) {
		if (this.pendingAction && this.currentActingCharacter) {
			const completeAction: BattleAction = {
				...this.pendingAction,
				targetId,
			} as BattleAction;

			this.selectAction(this.currentActingCharacter, completeAction);
		}
	}

	private hideTargetMenu() {
		if (this.targetMenu) {
			this.targetMenu.destroy();
			this.targetMenu = null;
			this.focusableTargetMenu = null;
		}

		if (this.targetWindow) {
			this.targetWindow.fadeOut({
				duration: 300,
				onComplete: () => {
					this.targetWindow?.destroy();
					this.targetWindow = null;
				},
			});
		}

		this.focusManager?.popLayer();
	}

	private hideSkillMenu() {
		if (this.skillMenu) {
			this.skillMenu.destroy();
			this.skillMenu = null;
			this.focusableSkillMenu = null;
		}

		if (this.skillWindow) {
			this.skillWindow.fadeOut({
				duration: 300,
				onComplete: () => {
					this.skillWindow?.destroy();
					this.skillWindow = null;
				},
			});
		}

		this.focusManager?.popLayer();
	}

	private beginAction(character: Character, action: Partial<BattleAction>) {
		this.currentActingCharacter = character;
		this.pendingAction = action;

		// Check if action needs target selection
		if (
			action.type === ActionType.ATTACK ||
			(action.type === ActionType.SKILL && action.skillId)
		) {
			const skill = action.skillId
				? this.availableSkills.find((s) => s.id === action.skillId)
				: null;

			if (action.type === ActionType.ATTACK || (skill && skill.damage)) {
				// Damage action - show enemy targets
				this.showTargetMenu(
					this.enemyParty.filter((e) => e.isAlive),
					"enemies",
				);
			} else if (skill && skill.healing) {
				// Healing action - show player targets
				this.showTargetMenu(
					this.playerParty.filter((p) => p.isAlive),
					"allies",
				);
			}
		} else {
			// No target needed, complete action
			this.selectAction(character, action as BattleAction);
		}
	}

	private selectAction(character: Character, action: BattleAction) {
		character.selectedAction = action;
		this.hideAllMenus();

		// Move to next character
		this.turnIndex++;
		this.processNextCharacter();
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
			this.currentPhase = BattlePhase.BATTLE_END;
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
		this.calculateTurnOrder();

		// Start new turn
		this.currentPhase = BattlePhase.SELECTING_ACTIONS;
		this.processNextCharacter();
	}

	private hideAllMenus() {
		if (this.actionMenu) {
			this.actionMenu.destroy();
			this.actionMenu = null;
			this.focusableActionMenu = null;
		}

		if (this.skillMenu) {
			this.skillMenu.destroy();
			this.skillMenu = null;
			this.focusableSkillMenu = null;
		}

		if (this.targetMenu) {
			this.targetMenu.destroy();
			this.targetMenu = null;
			this.focusableTargetMenu = null;
		}

		if (this.actionWindow) {
			this.actionWindow.fadeOut({
				duration: 300,
				onComplete: () => {
					this.actionWindow?.destroy();
					this.actionWindow = null;
				},
			});
		}

		if (this.skillWindow) {
			this.skillWindow.fadeOut({
				duration: 300,
				onComplete: () => {
					this.skillWindow?.destroy();
					this.skillWindow = null;
				},
			});
		}

		if (this.targetWindow) {
			this.targetWindow.fadeOut({
				duration: 300,
				onComplete: () => {
					this.targetWindow?.destroy();
					this.targetWindow = null;
				},
			});
		}

		// Pop all menu layers
		this.focusManager?.popLayer();
		this.focusManager?.popLayer();
		this.focusManager?.popLayer();

		// Clear pending action state
		this.pendingAction = null;
		this.currentActingCharacter = null;
	}

	destroy() {
		this.hideAllMenus();

		if (this.focusManager) {
			this.focusManager.destroy();
			this.focusManager = null;
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
