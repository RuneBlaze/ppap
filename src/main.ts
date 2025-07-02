import './style.css'
import Phaser from 'phaser'
import { fonts, getFontStyle, getAllFontKeys, loadFonts } from './fonts'
import { CardManager } from './CardManager'
import { exampleCards } from './cards'

class GameScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private player?: Phaser.GameObjects.Rectangle
  private fontTexts: Phaser.GameObjects.Text[] = []
  private cardManager?: CardManager
  private cursorSprite?: Phaser.GameObjects.Image

  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    // Show loading message
    this.add.text(Math.floor(427/2), Math.floor(240/2), 'Loading fonts and assets...', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      resolution: 1
    }).setOrigin(0.5)
    
    // Load card assets
    this.load.image('card-back', './src/assets/card.png')
    this.load.image('card-flipped', './src/assets/card-back.png')
    this.load.spritesheet('card-art', './src/assets/card_art.png', {
      frameWidth: 37, // Card art area width
      frameHeight: 25 // Card art area height
    })
    
    // Load cursor image
    this.load.image('cursor', './src/assets/cursor.png')
  }

  async create() {
    // Simple dark background
    this.cameras.main.setBackgroundColor('#1a1a2e')
    
    // Hide default cursor and create sprite-based cursor
    this.input.setDefaultCursor('none')
    this.createCursorSprite()
    
    // Create a simple player square
    this.player = this.add.rectangle(20, 20, 16, 16, 0x00ff41)
    
    // Set up input
    this.cursors = this.input.keyboard?.createCursorKeys()
    
    // Load fonts and then create the demo
    try {
      await loadFonts()
      this.createFontDemo()
    } catch (error) {
      console.error('Failed to load fonts:', error)
      this.createFallbackDemo()
    }
    
    // Initialize card system
    this.initializeCardSystem()
  }
  
  private initializeCardSystem(): void {
    this.cardManager = new CardManager(this)
    
    // Add some example cards to hand
    const handCards = exampleCards.slice(0, 5) // First 5 cards
    this.cardManager.addCards(handCards, 'hand')
    
    // Set up input for playing cards
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.cardManager?.playSelectedCards()
    })
    
    // Add instruction text
    this.add.text(10, 10, 'Click cards to select, SPACE to play', {
      ...getFontStyle('retro', 6),
      color: '#ffffff'
    }).setPosition(Math.floor(10), Math.floor(10))
  }

  createFontDemo() {
    // Clear any existing demo
    this.fontTexts.forEach(text => text.destroy())
    this.fontTexts = []

    const fontKeys = getAllFontKeys()
    const startY = 25
    const lineHeight = 12
    
    // Add title (moved to not overlap with cards)
    const title = this.add.text(Math.floor(320), Math.floor(5), 'RETRO FONTS', {
      fontSize: '8px',
      color: '#00ff41',
      fontFamily: 'Arial',
      resolution: 1
    }).setOrigin(0.5, 0)
    
    this.fontTexts.push(title)

    // Create demo text for each font (compact version)
    fontKeys.slice(0, 6).forEach((fontKey, index) => {
      const y = Math.floor(startY + (index * lineHeight))
      const font = fonts[fontKey]
      
      try {
        // Create sample text using the font
        const sampleText = `${fontKey}: ABC123`
        const textObj = this.add.text(Math.floor(250), y, sampleText, {
          fontFamily: font.family,
          fontSize: `${Math.min(font.size, 6)}px`,
          color: '#ffffff',
          resolution: 1
        })
        
        this.fontTexts.push(textObj)
        
      } catch (error) {
        console.warn(`Failed to create text with font ${fontKey}:`, error)
        
        // Fallback text
        const fallbackText = this.add.text(Math.floor(250), y, `${fontKey}: [Loading...]`, {
          fontSize: '6px',
          color: '#ff6666',
          fontFamily: 'Arial',
          resolution: 1
        })
        
        this.fontTexts.push(fallbackText)
      }
    })
  }

  createFallbackDemo() {
    this.add.text(Math.floor(350), Math.floor(50), 'Failed to load fonts', {
      fontSize: '8px',
      color: '#ff6666',
      fontFamily: 'Arial',
      align: 'center',
      resolution: 1
    }).setOrigin(0.5)
  }

  private createCursorSprite(): void {
    // Create cursor sprite
    this.cursorSprite = this.add.image(0, 0, 'cursor')
    this.cursorSprite.setOrigin(0, 0) // Top-left origin for precise positioning
    this.cursorSprite.setDepth(10000) // Always on top
    
    // Set up mouse tracking
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.cursorSprite) {
        // Convert screen coordinates to game coordinates
        const camera = this.cameras.main
        this.cursorSprite.x = camera.scrollX + pointer.x / camera.zoom
        this.cursorSprite.y = camera.scrollY + pointer.y / camera.zoom
      }
    })
  }

  update(time: number, delta: number) {
    if (!this.cursors || !this.player) return

    const speed = 2

    // Simple movement - keep player in upper left area so it doesn't overlap font demo or cards
    if (this.cursors.left?.isDown) {
      this.player.x = Math.max(8, this.player.x - speed)
    }
    if (this.cursors.right?.isDown) {
      this.player.x = Math.min(80, this.player.x + speed) // Limited to left side
    }
    if (this.cursors.up?.isDown) {
      this.player.y = Math.max(8, this.player.y - speed)
    }
    if (this.cursors.down?.isDown) {
      this.player.y = Math.min(40, this.player.y + speed) // Limited to top area
    }
    
    // Update card system
    if (this.cardManager) {
      this.cardManager.update(time, delta)
    }
  }
}

// Calculate the maximum scale that fits the viewport while maintaining aspect ratio
function calculateScale() {
  const targetWidth = 427
  const targetHeight = 240
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  const scaleX = Math.floor(windowWidth / targetWidth)
  const scaleY = Math.floor(windowHeight / targetHeight)
  
  // Use the smaller scale to ensure it fits, minimum scale of 1
  return Math.max(1, Math.min(scaleX, scaleY))
}

// Phaser game configuration
const scale = calculateScale()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 427,
  height: 240,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  antialias: false,
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: scale
  },
  render: {
    pixelArt: true,
    antialias: false
  }
}

// Initialize the game
const game = new Phaser.Game(config)

// Handle window resize to recalculate scale
window.addEventListener('resize', () => {
  const newScale = calculateScale()
  game.scale.setZoom(newScale)
})
