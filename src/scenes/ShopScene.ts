import { DrawUtils } from "../draw-utils";
import { Palette } from "../palette";
import { List, type ListItem } from "../ui/components/List";
import { Menu, type MenuItem } from "../ui/components/Menu";
import { Container } from "../ui/layout/Container";
import { Button } from "../ui/primitives/Button";
import { Divider } from "../ui/primitives/Divider";
import { Gauge } from "../ui/primitives/Gauge";
import { NumberDisplay } from "../ui/primitives/NumberDisplay";
import { ProgressBar } from "../ui/primitives/ProgressBar";
import { Slider } from "../ui/primitives/Slider";
import { TextBlock } from "../ui/primitives/TextBlock";
import { Toggle } from "../ui/primitives/Toggle";
import { Window } from "../ui/primitives/Window";
import {
	FocusableGrid,
	FocusableList,
	FocusableMenu,
} from "../ui/state/FocusableWrappers";
import { FocusManager, type FocusToken } from "../ui/state/FocusManager";
import { GridNavigationController } from "../ui/state/GridNavigationController";
import { BaseScene } from "./BaseScene";

export class ShopScene extends BaseScene {
	private mainMenu: Menu | null = null;
	private buyMenu: Menu | null = null;
	private sellMenu: Menu | null = null;
	private gossipMenu: Menu | null = null;
	private shopMenuButton: Button | null = null;

	// Window references for fade transitions
	private mainMenuWindow: Window | null = null;
	private buyMenuWindow: Window | null = null;
	private sellMenuWindow: Window | null = null;
	private gossipMenuWindow: Window | null = null;

	// Focus Management System
	private focusManager: FocusManager | null = null;
	private listFocusToken: FocusToken | null = null;
	private gridFocusToken: FocusToken | null = null;
	private shopMenuFocusToken: FocusToken | null = null;

	// Menu wrapper components
	private focusableMainMenu: FocusableMenu | null = null;
	private focusableBuyMenu: FocusableMenu | null = null;
	private focusableSellMenu: FocusableMenu | null = null;
	private focusableGossipMenu: FocusableMenu | null = null;

	// New Navigation Demo Components
	private itemList: List | null = null;
	private gridNavigation: GridNavigationController | null = null;
	private gridButtons: Button[] = [];
	private focusableList: FocusableList | null = null;
	private focusableGrid: FocusableGrid | null = null;

	// UI Demo Components
	private demoButtons: Button[] = [];
	private demoGauges: Gauge[] = [];
	private demoProgressBars: ProgressBar[] = [];
	private demoSliders: Slider[] = [];
	private demoToggles: Toggle[] = [];
	private demoNumberDisplays: NumberDisplay[] = [];
	private playerGold: number = 1250;
	private playerLevel: number = 15;
	private playerHP: number = 85;
	private playerMP: number = 42;

	constructor() {
		super("ShopScene");
	}

	protected preloadSceneAssets() {
		DrawUtils.preloadAssets(this);
	}

	protected createScene() {
		// Initialize the focus management system
		this.initializeFocusManager();

		// this.createUIDemo();
		this.createShopMenuButton();
		this.createNavigationDemo();
		this.createGradientDemo();
	}

	private createShopMenuButton() {
		this.shopMenuButton = new Button(this, {
			x: 330,
			y: 20,
			width: 80,
			height: 30,
			text: "Shop Menu",
			onPointerUp: () => this.toggleMainMenu(),
		});

		// Register shop menu button with focus manager
		const focusableButton = {
			activate: () => {
				this.shopMenuButton?.setAlpha(0.7);
				// Override space key for this component
				this.input.keyboard?.on("keydown-SPACE", this.toggleMainMenu, this);
			},
			deactivate: () => {
				this.shopMenuButton?.setAlpha(1.0);
				this.input.keyboard?.off("keydown-SPACE", this.toggleMainMenu, this);
			},
			destroy: () => {
				this.shopMenuButton?.destroy();
			},
		};

		this.shopMenuFocusToken = this.focusManager!.register(
			"shopMenuButton",
			focusableButton,
		);
	}

	private initializeFocusManager() {
		this.focusManager = new FocusManager(this);

		// Listen for focus changes to provide debug feedback
		this.focusManager.on("focusChanged", (event: any) => {
			console.log(
				`[${event.layer}] Focus changed: ${event.oldName || "none"} → ${event.newName || "none"}`,
			);
		});

		// Listen for layer changes
		this.focusManager.on("layerChanged", (event: any) => {
			console.log(
				`Layer ${event.action}: ${event.layerName} (depth: ${event.depth})`,
			);
		});
	}

	private createNavigationDemo() {
		// Create a scrollable list demo
		this.createScrollableListDemo();

		// Create a grid navigation demo
		this.createGridNavigationDemo();

		// Set initial focus to the list
		if (this.listFocusToken) {
			this.focusManager?.focus(this.listFocusToken);
		}

		// Add instruction text with fade transition
		new Window(this, {
			x: 20,
			y: 180,
			width: 387,
			height: 50,
			transition: { type: "fade", duration: 800 },
		});
		new TextBlock(this, {
			x: 30,
			y: 190,
			text: "TAB: Switch focus | SPACE: Open Shop Menu | D: Toggle Dithering",
			fontKey: "everydayStandard",
			color: Palette.CYAN,
		});
		new TextBlock(this, {
			x: 30,
			y: 205,
			text: "Submenus will create new focus layers!",
			fontKey: "everydayStandard",
			color: Palette.YELLOW,
		});
	}

	private createScrollableListDemo() {
		// Create title for list demo with fade transition
		new Window(this, {
			x: 20,
			y: 20,
			width: 197,
			height: 40,
			transition: { type: "fade", duration: 400000 },
		});
		new TextBlock(this, {
			x: 30,
			y: 32,
			text: "Scrollable List Demo",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Create sample items with some disabled
		const listItems: ListItem[] = [
			{ text: "Health Potion", value: "potion" },
			{ text: "Mana Potion", value: "mana" },
			{ text: "Antidote", value: "antidote" },
			{ text: "Phoenix Down", value: "phoenix", disabled: true },
			{ text: "Elixir", value: "elixir" },
			{ text: "Ether", value: "ether" },
			{ text: "Tent", value: "tent" },
			{ text: "Cottage", value: "cottage", disabled: true },
			{ text: "Smoke Bomb", value: "smoke" },
			{ text: "Flash Bomb", value: "flash" },
			{ text: "Grenade", value: "grenade" },
			{ text: "Shuriken", value: "shuriken" },
		];

		this.itemList = new List(this, {
			x: 20,
			y: 70,
			width: 197,
			height: 100,
			items: listItems,
			maxVisibleItems: 6,
			onSelect: (item, _index) => {
				console.log(`Selected: ${item.text} (${item.value})`);
				// Demo: Remove gold when buying
				if (item.value === "potion") {
					this.playerGold = Math.max(0, this.playerGold - 25);
					this.demoNumberDisplays[1]?.setValue(this.playerGold, true);
				}
			},
			onCancel: () => {
				console.log("List cancelled");
			},
		});

		// Register with focus manager (NO direct activation)
		this.focusableList = new FocusableList(this.itemList);
		this.listFocusToken = this.focusManager!.register(
			"itemList",
			this.focusableList,
		);
	}

	private createGridNavigationDemo() {
		// Create title for grid demo with fade transition
		new Window(this, {
			x: 227,
			y: 20,
			width: 180,
			height: 40,
			transition: { type: "fade", duration: 600 },
		});
		new TextBlock(this, {
			x: 237,
			y: 32,
			text: "Grid Navigation Demo",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Create 3x3 grid of buttons
		const gridLayout = { rows: 3, cols: 3, wraparound: true };
		this.gridNavigation = new GridNavigationController(this, gridLayout);

		const gridItems = [
			"Sword",
			"Axe",
			"Bow",
			"Shield",
			"Armor",
			"Helm",
			"Ring",
			"Amulet",
			"Boots",
		];

		this.gridButtons = [];
		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 3; col++) {
				const index = row * 3 + col;
				const button = new Button(this, {
					x: 237 + col * 50,
					y: 70 + row * 25,
					width: 45,
					height: 20,
					text: gridItems[index],
					onPointerUp: () => {
						console.log(`Grid item selected: ${gridItems[index]}`);
					},
				});
				this.gridButtons.push(button);
			}
		}

		// Setup grid navigation
		this.gridNavigation.setItems(gridItems.length);
		this.gridNavigation.on(
			"changed",
			(index: number, oldIndex: number, _row: number, _col: number) => {
				// Update button focus states
				if (oldIndex >= 0 && oldIndex < this.gridButtons.length) {
					// Reset previous button highlight
					this.gridButtons[oldIndex].setAlpha(1.0);
				}
				if (index >= 0 && index < this.gridButtons.length) {
					// Highlight current button
					this.gridButtons[index].setAlpha(0.7);
				}
			},
		);

		this.gridNavigation.on("activated", (index: number) => {
			console.log(`Grid activated: ${gridItems[index]}`);
		});

		// Register with focus manager (NO direct activation or highlighting)
		this.focusableGrid = new FocusableGrid(this.gridNavigation);
		this.gridFocusToken = this.focusManager!.register(
			"gridNavigation",
			this.focusableGrid,
		);
	}

	private createGradientDemo() {
		// Create title for gradient demo
		new Window(this, {
			x: 20,
			y: 240,
			width: 387,
			height: 40,
			transition: { type: "fade", duration: 800 },
		});
		new TextBlock(this, {
			x: 30,
			y: 252,
			text: "Gradient (for Dithering Demo)",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		const graphics = this.add.graphics();
		DrawUtils.drawGauge(this, graphics, {
			x: 0,
			y: 0,
			width: 387,
			height: 30,
			value: 100,
			maxValue: 100,
			gradientStart: Palette.BLACK,
			gradientEnd: Palette.WHITE,
			quantize: false,
			borderColor: Palette.WHITE,
		});

		for (let i = 0; i < 4; i++) {
			DrawUtils.drawIcon(this, 10 + i * 16, 10, 100 + i);
		}
	}

	private toggleMainMenu() {
		if (this.mainMenu) {
			this.hideMainMenu();
		} else {
			this.showMainMenu();
		}
	}

	private showMainMenu() {
		if (this.mainMenu) {
			// Re-focus existing menu
			if (this.focusableMainMenu) {
				this.focusManager?.focus(
					(this.focusableMainMenu.getMenu() as any).focusToken,
				);
			}
			return;
		}

		// Push new focus layer for shop menu
		this.focusManager?.pushLayer("shopMenu");

		this.hideAllMenus();

		// Create window with fade transition
		this.mainMenuWindow = new Window(this, {
			x: 100,
			y: 100,
			width: 200,
			height: 120,
			transition: { type: "fade", duration: 400 },
		});

		const menuItems: MenuItem[] = [
			{ text: "Buy", onSelect: () => this.showBuyMenu() },
			{ text: "Sell", onSelect: () => this.showSellMenu() },
			{ text: "Gossip", onSelect: () => this.showGossipMenu() },
			{ text: "Leave", onSelect: () => this.hideMainMenu() },
		];

		this.mainMenu = new Menu(this, {
			x: 100,
			y: 100,
			width: 200,
			items: menuItems,
			onCancel: () => this.hideMainMenu(),
		});

		// Register main menu with focus manager in shop layer
		this.focusableMainMenu = new FocusableMenu(this.mainMenu);
		const token = this.focusManager!.register(
			"mainMenu",
			this.focusableMainMenu,
			"shopMenu",
		);
		(this.mainMenu as any).focusToken = token;

		// Immediately focus the main menu
		this.focusManager?.focus(token);
	}

	private hideMainMenu() {
		if (this.mainMenu) {
			this.mainMenu.destroy();
			this.mainMenu = null;
			this.focusableMainMenu = null;
		}

		// Fade out the window
		if (this.mainMenuWindow) {
			this.mainMenuWindow.fadeOut({
				duration: 300,
				onComplete: () => {
					this.mainMenuWindow?.destroy();
					this.mainMenuWindow = null;
				},
			});
		}

		// Pop the shop menu layer, returning to default layer
		this.focusManager?.popLayer();
	}

	private showBuyMenu() {
		// Push new focus layer for buy submenu
		this.focusManager?.pushLayer("buyMenu");

		const buyItems: MenuItem[] = [
			{ text: "Potions", onSelect: () => console.log("Potions") },
			{ text: "Weapons", onSelect: () => console.log("Weapons") },
			{ text: "Armor", onSelect: () => console.log("Armor") },
		];

		this.buyMenu = new Menu(this, {
			x: 220,
			y: 100,
			width: 200,
			items: buyItems,
			onCancel: () => {
				this.buyMenu?.destroy();
				this.buyMenu = null;
				this.focusableBuyMenu = null;
				// Pop buy layer, return to shop menu layer
				this.focusManager?.popLayer();
				// Re-focus main menu
				if (this.focusableMainMenu) {
					this.focusManager?.focus(
						(this.focusableMainMenu.getMenu() as any).focusToken,
					);
				}
			},
		});

		// Register buy menu with focus manager in buy layer
		this.focusableBuyMenu = new FocusableMenu(this.buyMenu);
		const token = this.focusManager!.register(
			"buyMenu",
			this.focusableBuyMenu,
			"buyMenu",
		);
		(this.buyMenu as any).focusToken = token;

		// Focus the buy menu
		this.focusManager?.focus(token);
	}

	private showSellMenu() {
		// Push new focus layer for sell submenu
		this.focusManager?.pushLayer("sellMenu");

		const sellItems: MenuItem[] = [
			{ text: "You have nothing to sell.", onSelect: () => {} },
		];
		this.sellMenu = new Menu(this, {
			x: 180,
			y: 100,
			width: 240,
			items: sellItems,
			onCancel: () => {
				this.sellMenu?.destroy();
				this.sellMenu = null;
				this.focusableSellMenu = null;
				// Pop sell layer, return to shop menu layer
				this.focusManager?.popLayer();
				// Re-focus main menu
				if (this.focusableMainMenu) {
					this.focusManager?.focus(
						(this.focusableMainMenu.getMenu() as any).focusToken,
					);
				}
			},
		});

		// Register sell menu with focus manager
		this.focusableSellMenu = new FocusableMenu(this.sellMenu);
		const token = this.focusManager!.register(
			"sellMenu",
			this.focusableSellMenu,
			"sellMenu",
		);
		(this.sellMenu as any).focusToken = token;

		// Focus the sell menu
		this.focusManager?.focus(token);
	}

	private showGossipMenu() {
		// Push new focus layer for gossip submenu
		this.focusManager?.pushLayer("gossipMenu");

		const gossipItems: MenuItem[] = [
			{ text: '"The blacksmith is a nice fellow."', onSelect: () => {} },
		];
		this.gossipMenu = new Menu(this, {
			x: 20,
			y: 100,
			width: 387,
			items: gossipItems,
			onCancel: () => {
				this.gossipMenu?.destroy();
				this.gossipMenu = null;
				this.focusableGossipMenu = null;
				// Pop gossip layer, return to shop menu layer
				this.focusManager?.popLayer();
				// Re-focus main menu
				if (this.focusableMainMenu) {
					this.focusManager?.focus(
						(this.focusableMainMenu.getMenu() as any).focusToken,
					);
				}
			},
		});

		// Register gossip menu with focus manager
		this.focusableGossipMenu = new FocusableMenu(this.gossipMenu);
		const token = this.focusManager!.register(
			"gossipMenu",
			this.focusableGossipMenu,
			"gossipMenu",
		);
		(this.gossipMenu as any).focusToken = token;

		// Focus the gossip menu
		this.focusManager?.focus(token);
	}

	private hideAllMenus() {
		if (this.mainMenu) {
			this.mainMenu.destroy();
			this.mainMenu = null;
		}
		if (this.buyMenu) {
			this.buyMenu.destroy();
			this.buyMenu = null;
		}
		if (this.sellMenu) {
			this.sellMenu.destroy();
			this.sellMenu = null;
		}
		if (this.gossipMenu) {
			this.gossipMenu.destroy();
			this.gossipMenu = null;
		}

		// Clean up window references
		if (this.mainMenuWindow) {
			this.mainMenuWindow.destroy();
			this.mainMenuWindow = null;
		}
		if (this.buyMenuWindow) {
			this.buyMenuWindow.destroy();
			this.buyMenuWindow = null;
		}
		if (this.sellMenuWindow) {
			this.sellMenuWindow.destroy();
			this.sellMenuWindow = null;
		}
		if (this.gossipMenuWindow) {
			this.gossipMenuWindow.destroy();
			this.gossipMenuWindow = null;
		}
	}

	private createUIDemo() {
		// Create main demo container
		new Container(this);

		// Create UI Demo Title
		new Window(this, { x: 20, y: 20, width: 387, height: 40 });
		new TextBlock(this, {
			x: 30,
			y: 32,
			text: "UI Components Demo - Shop Scene",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Create Stats Panel (left side)
		this.createStatsPanel();

		// Create Controls Panel (right side)
		this.createControlsPanel();

		// Create Interactive Elements Panel (bottom)
		this.createInteractivePanel();

		// Initialize demo animations
		this.startDemoAnimations();
	}

	private createStatsPanel() {
		// Player Stats Window
		new Window(this, { x: 20, y: 70, width: 180, height: 120 });

		// Player info
		new TextBlock(this, {
			x: 30,
			y: 85,
			text: "Hero",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		const levelDisplay = new NumberDisplay(this, {
			x: 30,
			y: 100,
			value: this.playerLevel,
			fontKey: "everydayStandard",
			color: Palette.CYAN,
			formatValue: (value: number) => `Lv.${value}`,
		});
		this.demoNumberDisplays.push(levelDisplay);

		const goldDisplay = new NumberDisplay(this, {
			x: 30,
			y: 115,
			value: this.playerGold,
			fontKey: "everydayStandard",
			color: Palette.YELLOW,
			formatValue: (value: number) => `${value}G`,
		});
		this.demoNumberDisplays.push(goldDisplay);

		// HP Bar
		const hpBar = new ProgressBar(this, {
			x: 30,
			y: 135,
			width: 120,
			height: 8,
			value: this.playerHP,
			maxValue: 100,
			gradientStart: Palette.RED,
			gradientEnd: Palette.RED,
		});
		this.demoProgressBars.push(hpBar);

		new TextBlock(this, {
			x: 160,
			y: 135,
			text: "HP",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Add heart icon for HP
		// Draw 4x4 grid of icons (12-27)
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 4; col++) {
				const iconIndex = 12 + row * 4 + col;
				DrawUtils.drawIcon(this, 175 + col * 16, 135 + row * 16, iconIndex);
			}
		}

		// MP Bar
		const mpBar = new ProgressBar(this, {
			x: 30,
			y: 150,
			width: 120,
			height: 8,
			value: this.playerMP,
			maxValue: 100,
			gradientStart: Palette.BLUE,
			gradientEnd: Palette.BLUE,
		});
		this.demoProgressBars.push(mpBar);

		new TextBlock(this, {
			x: 160,
			y: 150,
			text: "MP",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Circular Gauge (ATB/Charging)
		const atbGauge = new Gauge(this, {
			x: 160,
			y: 110,
			radius: 15,
			value: 0,
			maxValue: 100,
			fillColor: Palette.GREEN,
			backgroundColor: Palette.DARK_GREEN,
		});
		this.demoGauges.push(atbGauge);

		new TextBlock(this, {
			x: 150,
			y: 170,
			text: "ATB",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});
	}

	private createControlsPanel() {
		// Controls Window
		new Window(this, { x: 220, y: 70, width: 187, height: 120 });

		new TextBlock(this, {
			x: 230,
			y: 85,
			text: "Shop Settings",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Volume Slider
		const volumeSlider = new Slider(this, {
			x: 230,
			y: 105,
			width: 120,
			height: 12,
			min: 0,
			max: 100,
			value: 75,
			orientation: "horizontal",
			showValue: true,
		});
		this.demoSliders.push(volumeSlider);

		new TextBlock(this, {
			x: 360,
			y: 105,
			text: "Vol",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Difficulty Slider
		const difficultySlider = new Slider(this, {
			x: 230,
			y: 125,
			width: 120,
			height: 12,
			min: 1,
			max: 10,
			value: 5,
			orientation: "horizontal",
			showValue: true,
		});
		this.demoSliders.push(difficultySlider);

		new TextBlock(this, {
			x: 360,
			y: 125,
			text: "Diff",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		// Toggles
		const soundToggle = new Toggle(this, {
			x: 230,
			y: 145,
			width: 60,
			height: 16,
			initialValue: true,
			labels: { on: "ON", off: "OFF" },
			style: "switch",
		});
		this.demoToggles.push(soundToggle);

		new TextBlock(this, {
			x: 300,
			y: 145,
			text: "Sound",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});

		const autoSaveToggle = new Toggle(this, {
			x: 230,
			y: 165,
			width: 60,
			height: 16,
			initialValue: false,
			labels: { on: "ON", off: "OFF" },
			style: "checkbox",
		});
		this.demoToggles.push(autoSaveToggle);

		new TextBlock(this, {
			x: 300,
			y: 165,
			text: "Auto Save",
			fontKey: "everydayStandard",
			color: Palette.WHITE,
		});
	}

	private createInteractivePanel() {
		// Interactive Elements Window
		new Window(this, { x: 20, y: 200, width: 387, height: 35 });

		// Horizontal Divider
		new Divider(this, {
			x: 30,
			y: 218,
			width: 367,
			height: 1,
			orientation: "horizontal",
			style: "decorative",
		});

		// Demo Action Buttons
		const buyButton = new Button(this, {
			x: 30,
			y: 205,
			width: 60,
			height: 20,
			text: "Buy Item",
			onPointerUp: () => {
				this.playerGold = Math.max(0, this.playerGold - 50);
				this.demoNumberDisplays[1].setValue(this.playerGold, true);
				console.log("Item purchased!");
			},
		});
		this.demoButtons.push(buyButton);

		const healButton = new Button(this, {
			x: 100,
			y: 205,
			width: 60,
			height: 20,
			text: "Heal",
			onPointerUp: () => {
				this.playerHP = Math.min(100, this.playerHP + 25);
				this.demoProgressBars[0].setValue(this.playerHP, true);
				console.log("HP restored!");
			},
		});
		this.demoButtons.push(healButton);

		const restoreButton = new Button(this, {
			x: 170,
			y: 205,
			width: 60,
			height: 20,
			text: "Restore",
			onPointerUp: () => {
				this.playerMP = Math.min(100, this.playerMP + 25);
				this.demoProgressBars[1].setValue(this.playerMP, true);
				console.log("MP restored!");
			},
		});
		this.demoButtons.push(restoreButton);

		const levelUpButton = new Button(this, {
			x: 240,
			y: 205,
			width: 60,
			height: 20,
			text: "Level Up",
			onPointerUp: () => {
				this.playerLevel++;
				this.demoNumberDisplays[0].setValue(this.playerLevel, true);
				console.log("Level up!");
			},
		});
		this.demoButtons.push(levelUpButton);

		const resetButton = new Button(this, {
			x: 310,
			y: 205,
			width: 60,
			height: 20,
			text: "Reset",
			onPointerUp: () => {
				this.resetDemoValues();
				console.log("Demo reset!");
			},
		});
		this.demoButtons.push(resetButton);
	}

	private startDemoAnimations() {
		// Animate ATB gauge
		if (this.demoGauges.length > 0) {
			this.time.addEvent({
				delay: 3000,
				callback: () => {
					const atbGauge = this.demoGauges[0];
					const newValue = atbGauge.getCurrentValue() >= 100 ? 0 : 100;
					atbGauge.setValue(newValue, true);
				},
				loop: true,
			});
		}

		// Animate gold counter occasionally
		this.time.addEvent({
			delay: 8000,
			callback: () => {
				this.playerGold += 25;
				this.demoNumberDisplays[1].setValue(this.playerGold, true);
			},
			loop: true,
		});
	}

	private resetDemoValues() {
		this.playerGold = 1250;
		this.playerLevel = 15;
		this.playerHP = 85;
		this.playerMP = 42;

		this.demoNumberDisplays[0].setValue(this.playerLevel, true);
		this.demoNumberDisplays[1].setValue(this.playerGold, true);
		this.demoProgressBars[0].setValue(this.playerHP, true);
		this.demoProgressBars[1].setValue(this.playerMP, true);

		if (this.demoGauges.length > 0) {
			this.demoGauges[0].setValue(0, true);
		}
	}

	destroy() {
		// Cleanup focus manager (this will handle component cleanup)
		if (this.focusManager) {
			this.focusManager.destroy();
			this.focusManager = null;
		}

		// Reset tokens
		this.listFocusToken = null;
		this.gridFocusToken = null;

		// Clean up wrapper references
		this.focusableList = null;
		this.focusableGrid = null;

		// Clean up component references
		this.itemList = null;
		this.gridNavigation = null;

		// Cleanup existing menus
		this.hideAllMenus();
	}
}
