import Phaser from 'phaser';
import { loadFonts } from '../fonts';
import { Palette } from '../palette';
import { Menu, type MenuItem } from '../ui/components/Menu';
import { Container } from '../ui/layout/Container';
import { Button } from '../ui/primitives/Button';
import { Divider } from '../ui/primitives/Divider';
import { Gauge } from '../ui/primitives/Gauge';
import { NumberDisplay } from '../ui/primitives/NumberDisplay';
import { ProgressBar } from '../ui/primitives/ProgressBar';
import { Slider } from '../ui/primitives/Slider';
import { TextBlock } from '../ui/primitives/TextBlock';
import { Toggle } from '../ui/primitives/Toggle';
import { Window } from '../ui/primitives/Window';
import cursorImg from '../assets/cursor.png';

export class ShopScene extends Phaser.Scene {
  private mainMenu: Menu | null = null;
  private buyMenu: Menu | null = null;
  private sellMenu: Menu | null = null;
  private gossipMenu: Menu | null = null;
  private shopMenuButton: Button | null = null;
  
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
    super('ShopScene');
  }

  preload() {
    this.load.image('cursor', cursorImg);
  }

  async create() {
    this.cameras.main.setBackgroundColor(Palette.BLACK);
    
    // Wait for fonts to load before creating UI elements
    await loadFonts();
    
    this.createUIDemo();
    this.createShopMenuButton();
  }

  private createShopMenuButton() {
    this.shopMenuButton = new Button(this, {
      x: 430,
      y: 20,
      width: 80,
      height: 30,
      text: 'Shop Menu',
      onPointerUp: () => this.toggleMainMenu()
    });
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
      this.mainMenu.activate();
      return;
    }

    this.hideAllMenus();
    const menuItems: MenuItem[] = [
      { text: 'Buy', onSelect: () => this.showBuyMenu() },
      { text: 'Sell', onSelect: () => this.showSellMenu() },
      { text: 'Gossip', onSelect: () => this.showGossipMenu() },
      { text: 'Leave', onSelect: () => this.hideMainMenu() }
    ];

    this.mainMenu = new Menu(this, {
      x: 100,
      y: 100,
      width: 200,
      items: menuItems
    });
  }

  private hideMainMenu() {
    if (this.mainMenu) {
      this.mainMenu.destroy();
      this.mainMenu = null;
    }
  }

  private showBuyMenu() {
    this.mainMenu?.deactivate();
    const buyItems: MenuItem[] = [
      { text: 'Potions', onSelect: () => console.log('Potions') },
      { text: 'Weapons', onSelect: () => console.log('Weapons') },
      { text: 'Armor', onSelect: () => console.log('Armor') }
    ];

    this.buyMenu = new Menu(this, {
      x: 350,
      y: 100,
      width: 200,
      items: buyItems,
      onCancel: () => {
        this.buyMenu?.destroy();
        this.buyMenu = null;
        this.showMainMenu();
      }
    });
  }

  private showSellMenu() {
    this.mainMenu?.deactivate();
    const sellItems: MenuItem[] = [{ text: 'You have nothing to sell.', onSelect: () => {} }];
    this.sellMenu = new Menu(this, {
      x: 350,
      y: 100,
      width: 300,
      items: sellItems,
      onCancel: () => {
        this.sellMenu?.destroy();
        this.sellMenu = null;
        this.showMainMenu();
      }
    });
  }

  private showGossipMenu() {
    this.mainMenu?.deactivate();
    const gossipItems: MenuItem[] = [{ text: '"The blacksmith is a nice fellow."', onSelect: () => {} }];
    this.gossipMenu = new Menu(this, {
        x: 350,
        y: 100,
        width: 400,
        items: gossipItems,
        onCancel: () => {
          this.gossipMenu?.destroy();
          this.gossipMenu = null;
          this.showMainMenu();
        }
    });
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
  }

  private createUIDemo() {
    // Create main demo container
    new Container(this);
    
    // Create UI Demo Title
    new Window(this, { x: 20, y: 20, width: 387, height: 40 });
    new TextBlock(this, {
      x: 30,
      y: 32,
      text: 'UI Components Demo - Shop Scene',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
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
      text: 'Hero',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
    });
    
    const levelDisplay = new NumberDisplay(this, {
      x: 30,
      y: 100,
      value: this.playerLevel,
      fontKey: 'everydayStandard',
      color: Palette.CYAN,
      formatValue: (value: number) => `Lv.${value}`
    });
    this.demoNumberDisplays.push(levelDisplay);
    
    const goldDisplay = new NumberDisplay(this, {
      x: 30,
      y: 115,
      value: this.playerGold,
      fontKey: 'everydayStandard',
      color: Palette.YELLOW,
      formatValue: (value: number) => `${value}G`
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
      gradientEnd: Palette.RED
    });
    this.demoProgressBars.push(hpBar);
    
    new TextBlock(this, {
      x: 160,
      y: 135,
      text: 'HP',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
    });
    
    // MP Bar
    const mpBar = new ProgressBar(this, {
      x: 30,
      y: 150,
      width: 120,
      height: 8,
      value: this.playerMP,
      maxValue: 100,
      gradientStart: Palette.BLUE,
      gradientEnd: Palette.BLUE
    });
    this.demoProgressBars.push(mpBar);
    
    new TextBlock(this, {
      x: 160,
      y: 150,
      text: 'MP',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
    });
    
    // Circular Gauge (ATB/Charging)
    const atbGauge = new Gauge(this, {
      x: 160,
      y: 110,
      radius: 15,
      value: 0,
      maxValue: 100,
      fillColor: Palette.GREEN,
      backgroundColor: Palette.DARK_GREEN
    });
    this.demoGauges.push(atbGauge);
    
    new TextBlock(this, {
      x: 150,
      y: 170,
      text: 'ATB',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
    });
  }

  private createControlsPanel() {
    // Controls Window
    new Window(this, { x: 220, y: 70, width: 187, height: 120 });
    
    new TextBlock(this, {
      x: 230,
      y: 85,
      text: 'Shop Settings',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
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
      orientation: 'horizontal',
      showValue: true
    });
    this.demoSliders.push(volumeSlider);
    
    new TextBlock(this, {
      x: 360,
      y: 105,
      text: 'Vol',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
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
      orientation: 'horizontal',
      showValue: true
    });
    this.demoSliders.push(difficultySlider);
    
    new TextBlock(this, {
      x: 360,
      y: 125,
      text: 'Diff',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
    });
    
    // Toggles
    const soundToggle = new Toggle(this, {
      x: 230,
      y: 145,
      width: 60,
      height: 16,
      initialValue: true,
      labels: { on: 'ON', off: 'OFF' },
      style: 'switch'
    });
    this.demoToggles.push(soundToggle);
    
    new TextBlock(this, {
      x: 300,
      y: 145,
      text: 'Sound',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
    });
    
    const autoSaveToggle = new Toggle(this, {
      x: 230,
      y: 165,
      width: 60,
      height: 16,
      initialValue: false,
      labels: { on: 'ON', off: 'OFF' },
      style: 'checkbox'
    });
    this.demoToggles.push(autoSaveToggle);
    
    new TextBlock(this, {
      x: 300,
      y: 165,
      text: 'Auto Save',
      fontKey: 'everydayStandard',
      color: Palette.WHITE
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
      orientation: 'horizontal',
      style: 'decorative'
    });
    
    // Demo Action Buttons
    const buyButton = new Button(this, {
      x: 30,
      y: 205,
      width: 60,
      height: 20,
      text: 'Buy Item',
      onPointerUp: () => {
        this.playerGold = Math.max(0, this.playerGold - 50);
        this.demoNumberDisplays[1].setValue(this.playerGold, true);
        console.log('Item purchased!');
      }
    });
    this.demoButtons.push(buyButton);
    
    const healButton = new Button(this, {
      x: 100,
      y: 205,
      width: 60,
      height: 20,
      text: 'Heal',
      onPointerUp: () => {
        this.playerHP = Math.min(100, this.playerHP + 25);
        this.demoProgressBars[0].setValue(this.playerHP, true);
        console.log('HP restored!');
      }
    });
    this.demoButtons.push(healButton);
    
    const restoreButton = new Button(this, {
      x: 170,
      y: 205,
      width: 60,
      height: 20,
      text: 'Restore',
      onPointerUp: () => {
        this.playerMP = Math.min(100, this.playerMP + 25);
        this.demoProgressBars[1].setValue(this.playerMP, true);
        console.log('MP restored!');
      }
    });
    this.demoButtons.push(restoreButton);
    
    const levelUpButton = new Button(this, {
      x: 240,
      y: 205,
      width: 60,
      height: 20,
      text: 'Level Up',
      onPointerUp: () => {
        this.playerLevel++;
        this.demoNumberDisplays[0].setValue(this.playerLevel, true);
        console.log('Level up!');
      }
    });
    this.demoButtons.push(levelUpButton);
    
    const resetButton = new Button(this, {
      x: 310,
      y: 205,
      width: 60,
      height: 20,
      text: 'Reset',
      onPointerUp: () => {
        this.resetDemoValues();
        console.log('Demo reset!');
      }
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
        loop: true
      });
    }
    
    // Animate gold counter occasionally
    this.time.addEvent({
      delay: 8000,
      callback: () => {
        this.playerGold += 25;
        this.demoNumberDisplays[1].setValue(this.playerGold, true);
      },
      loop: true
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
} 