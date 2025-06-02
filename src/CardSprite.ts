import Phaser from 'phaser'
import type { Card } from './cards'
import { getFontStyle } from './fonts'
import { match } from 'ts-pattern'

export type CardState = 'initialize' | 'active' | 'resolving' | 'resolved'

export const CardState = {
  INITIALIZE: 'initialize' as const,
  ACTIVE: 'active' as const,
  RESOLVING: 'resolving' as const,
  RESOLVED: 'resolved' as const
} as const

export interface CardPosition {
  x: number
  y: number
}

export interface CardZone {
  name: string
  bounds: Phaser.Geom.Rectangle
  cards: CardSprite[]
  maxCards?: number
}

export class CardSprite extends Phaser.GameObjects.Container {
  public static readonly CARD_WIDTH = 43
  public static readonly CARD_HEIGHT = 60
  
  private card: Card
  private cardState: CardState = CardState.INITIALIZE
  private cardBackground!: Phaser.GameObjects.Image
  private cardArt!: Phaser.GameObjects.Image
  private nameText!: Phaser.GameObjects.Text
  private costText!: Phaser.GameObjects.Text
  private descriptionText!: Phaser.GameObjects.Text
  private damageText?: Phaser.GameObjects.Text
  private shieldText?: Phaser.GameObjects.Text
  
  // Dragging
  private isDragging = false
  private dragOffsetX = 0
  private dragOffsetY = 0
  
  // Animation and effects
  private isSelected = false
  private isHovered = false
  private highlightTimer = 0
  private rotationTween?: Phaser.Tweens.Tween
  private shakeTween?: Phaser.Tweens.Tween
  private moveTween?: Phaser.Tweens.Tween
  private fadeTimer = 0
  
  // Grid and positioning
  private index = 0
  private targetX = 0
  private targetY = 0
  
  constructor(scene: Phaser.Scene, x: number, y: number, card: Card, index: number = 0) {
    super(scene, x, y)
    
    this.card = card
    this.index = index
    this.targetX = x
    this.targetY = y
    
    // Enable interactive for dragging
    this.setSize(CardSprite.CARD_WIDTH, CardSprite.CARD_HEIGHT)
    this.setInteractive({ draggable: true })
    
    this.createCardElements()
    this.setupEventListeners()
    
    // Start with initialization animation
    this.transitionTo(CardState.INITIALIZE)
    
    scene.add.existing(this)
  }
  
  private createCardElements(): void {
    // Card background
    this.cardBackground = this.scene.add.image(0, 0, 'card-back')
    this.cardBackground.setOrigin(0, 0)
    this.add(this.cardBackground)
    
    // Card art (will be added after background loads)
    this.cardArt = this.scene.add.image(3, 8, 'card-art')
    this.cardArt.setOrigin(0, 0)
    this.cardArt.setFrame(this.card.artIndex)
    this.cardArt.setVisible(false) // Hidden initially during fade-in
    this.add(this.cardArt)
    
    // Cost text (top-left)
    this.costText = this.scene.add.text(-2, -2, this.card.cost.toString(), {
      ...getFontStyle('retro', 6),
      color: '#ffffff'
    })
    this.costText.setOrigin(0, 0)
    this.add(this.costText)
    
    // Name text
    this.nameText = this.scene.add.text(21, 2, this.card.name, {
      ...getFontStyle('retro', 4),
      color: '#ffffff',
      wordWrap: { width: 38, useAdvancedWrap: true }
    })
    this.nameText.setOrigin(0.5, 0)
    this.add(this.nameText)
    
    // Description text
    this.descriptionText = this.scene.add.text(21, 35, this.card.description, {
      ...getFontStyle('retro', 3),
      color: '#cccccc',
      wordWrap: { width: 38, useAdvancedWrap: true }
    })
    this.descriptionText.setOrigin(0.5, 0)
    this.add(this.descriptionText)
    
    // Damage/shield text if applicable
    if (this.card.damage) {
      this.damageText = this.scene.add.text(38, 55, `⚔${this.card.damage}`, {
        ...getFontStyle('retro', 4),
        color: '#ff6666'
      })
      this.damageText.setOrigin(1, 1)
      this.add(this.damageText)
    }
    
    if (this.card.shield) {
      const shieldX = this.card.damage ? 20 : 38
      this.shieldText = this.scene.add.text(shieldX, 55, `🛡${this.card.shield}`, {
        ...getFontStyle('retro', 4),
        color: '#66b3ff'
      })
      this.shieldText.setOrigin(1, 1)
      this.add(this.shieldText)
    }
  }
  
  private setupEventListeners(): void {
    // Drag events
    this.on('dragstart', this.onDragStart, this)
    this.on('drag', this.onDrag, this)
    this.on('dragend', this.onDragEnd, this)
    
    // Pointer events
    this.on('pointerover', this.onPointerOver, this)
    this.on('pointerout', this.onPointerOut, this)
    this.on('pointerdown', this.onPointerDown, this)
    this.on('pointerup', this.onPointerUp, this)
  }
  
  private onDragStart(pointer: Phaser.Input.Pointer): void {
    if (this.cardState !== CardState.ACTIVE) return
    
    this.isDragging = true
    this.dragOffsetX = pointer.x - this.x
    this.dragOffsetY = pointer.y - this.y
    
    // Bring to front
    this.setDepth(1000)
    
    // Add shadow effect
    this.addShadowEffect()
    
    // Stop any movement tweens
    if (this.moveTween) {
      this.moveTween.stop()
      this.moveTween = undefined
    }
  }
  
  private onDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return
    
    this.x = pointer.x - this.dragOffsetX
    this.y = pointer.y - this.dragOffsetY
  }
  
  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    this.isDragging = false
    this.setDepth(this.index)
    this.removeShadowEffect()
    
    // Check for zone snap
    const snapResult = this.snapToZone(pointer.x, pointer.y)
    
    if (!snapResult.snapped) {
      // Return to original position
      this.smoothMoveTo(this.targetX, this.targetY)
    }
  }
  
  private onPointerOver(): void {
    if (this.cardState !== CardState.ACTIVE || this.isDragging) return
    
    this.isHovered = true
    this.highlightTimer = 0
    
    // Slight rotation on hover
    this.rotationTween = this.scene.tweens.add({
      targets: this,
      angle: Phaser.Math.Between(-3, 3),
      duration: 200,
      ease: 'Power2'
    })
  }
  
  private onPointerOut(): void {
    this.isHovered = false
    
    // Return to neutral rotation
    if (this.rotationTween) {
      this.rotationTween.stop()
    }
    
    this.rotationTween = this.scene.tweens.add({
      targets: this,
      angle: 0,
      duration: 150,
      ease: 'Power2'
    })
  }
  
  private onPointerDown(): void {
    if (this.cardState !== CardState.ACTIVE || this.isDragging) return
    // Handle selection logic here if needed
  }
  
  private onPointerUp(): void {
    if (this.cardState !== CardState.ACTIVE || this.isDragging) return
    
    // Quick click = select/deselect
    this.toggleSelection()
  }
  
  public toggleSelection(): void {
    this.isSelected = !this.isSelected
    this.updateSelectionVisuals()
  }
  
  private updateSelectionVisuals(): void {
    if (this.isSelected) {
      this.targetY -= 10 // Lift up when selected
      this.cardBackground.setTint(0xffffaa) // Slight yellow tint
    } else {
      this.targetY += 10
      this.cardBackground.clearTint()
    }
    
    this.smoothMoveTo(this.targetX, this.targetY)
  }
  
  public transitionTo(newState: CardState): void {
    if (this.cardState === newState) return
    
    const oldState = this.cardState
    this.cardState = newState
    
    match([oldState, newState])
      .with([CardState.INITIALIZE, CardState.ACTIVE], () => {
        this.fadeInCard()
      })
      .with([CardState.ACTIVE, CardState.RESOLVING], () => {
        this.moveToResolvingPosition()
      })
      .with([CardState.RESOLVING, CardState.RESOLVED], () => {
        this.moveOffScreen()
      })
      .otherwise(() => {
        // Handle other transitions
      })
  }
  
  private fadeInCard(): void {
    this.fadeTimer = 0
    this.cardArt.setVisible(false)
    
    // Fade in the card art over the background
    this.scene.time.delayedCall(100, () => {
      this.cardArt.setVisible(true)
      this.cardArt.setAlpha(0)
      
      this.scene.tweens.add({
        targets: this.cardArt,
        alpha: 1,
        duration: 300,
        ease: 'Power2'
      })
    })
  }
  
  private moveToResolvingPosition(): void {
    // Move to center screen for resolving
    const centerX = this.scene.cameras.main.width / 2 - CardSprite.CARD_WIDTH / 2
    const centerY = this.scene.cameras.main.height / 2 - CardSprite.CARD_HEIGHT / 2
    
    this.smoothMoveTo(centerX, centerY, 500)
  }
  
  private moveOffScreen(): void {
    // Move off-screen to the right
    const offScreenX = this.scene.cameras.main.width + CardSprite.CARD_WIDTH
    const offScreenY = this.scene.cameras.main.height - CardSprite.CARD_HEIGHT - 10
    
    this.smoothMoveTo(offScreenX, offScreenY, 300)
  }
  
  private smoothMoveTo(x: number, y: number, duration: number = 200): void {
    if (this.moveTween) {
      this.moveTween.stop()
    }
    
    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: x,
      y: y,
      duration: duration,
      ease: 'Power2'
    })
  }
  
  public scheduleShake(): void {
    if (this.shakeTween) {
      this.shakeTween.stop()
    }
    
    this.shakeTween = this.scene.tweens.add({
      targets: this,
      x: this.x + Phaser.Math.Between(-3, 3),
      y: this.y + Phaser.Math.Between(-3, 3),
      duration: 50,
      ease: 'Power2',
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.x = this.targetX
        this.y = this.targetY
      }
    })
  }
  
  public scheduleSmallShake(): void {
    if (this.shakeTween) {
      this.shakeTween.stop()
    }
    
    this.shakeTween = this.scene.tweens.add({
      targets: this,
      x: this.x + Phaser.Math.Between(-1, 1),
      y: this.y + Phaser.Math.Between(-1, 1),
      duration: 30,
      ease: 'Power2',
      yoyo: true,
      repeat: 5
    })
  }
  
  private addShadowEffect(): void {
    // Add a shadow effect when dragging
    this.cardBackground.setTint(0xcccccc)
  }
  
  private removeShadowEffect(): void {
    if (!this.isSelected) {
      this.cardBackground.clearTint()
    }
  }
  
  private snapToZone(_x: number, _y: number): { snapped: boolean, zone?: CardZone } {
    // This would check against registered card zones
    // For now, just return false
    return { snapped: false }
  }
  
  public updatePosition(index: number, targetX: number, targetY: number): void {
    this.index = index
    this.targetX = targetX
    this.targetY = targetY
    this.setDepth(index)
    
    if (!this.isDragging) {
      this.smoothMoveTo(targetX, targetY)
    }
  }
  
  public getCard(): Card {
    return this.card
  }
  
  public getState(): CardState {
    return this.cardState
  }
  
  public isInState(state: CardState): boolean {
    return this.cardState === state
  }
  
  public canTransitionToResolving(): boolean {
    return this.cardState === CardState.ACTIVE && !this.isDragging
  }
  
  update(_time: number, delta: number): void {
    if (this.isHovered) {
      this.highlightTimer += delta
    }
    
    // Update fade timer for card initialization
    if (this.cardState === CardState.INITIALIZE) {
      this.fadeTimer += delta
    }
  }
  
  destroy(fromScene?: boolean): void {
    // Clean up tweens
    if (this.rotationTween) this.rotationTween.stop()
    if (this.shakeTween) this.shakeTween.stop()
    if (this.moveTween) this.moveTween.stop()
    
    super.destroy(fromScene)
  }
} 