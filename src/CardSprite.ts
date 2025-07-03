import Phaser from 'phaser'
import type { Card } from './cards'
import { getFontStyle } from './fonts'
import { match } from 'ts-pattern'

export type CardState = 'initialize' | 'active' | 'resolving' | 'resolved' | 'flipped'

export const CardState = {
  INITIALIZE: 'initialize' as const,
  ACTIVE: 'active' as const,
  RESOLVING: 'resolving' as const,
  RESOLVED: 'resolved' as const,
  FLIPPED: 'flipped' as const
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

interface TextRenderConfig {
  compression: number
  yMultiplier: number
  skip: boolean
}

interface PrintableTokens {
  tokens: string[]
  canPrint: boolean
}

// Custom shader for 3D hover effects like Godot
class Card3DHoverShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      renderTarget: true,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float hovering;
uniform vec2 mouseScreenPos;
uniform float time;
uniform vec2 cardSize;
uniform float flipProgress;

varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;
    vec4 color = texture2D(uMainSampler, uv);
    
    // Apply flip transformation first
    if (flipProgress > 0.0) {
        vec2 center = vec2(0.5, 0.5);
        vec2 fromCenter = uv - center;

        // Add some perspective warp based on progress
        // This makes it look like it's rotating in 3D
        float perspective = fromCenter.y * fromCenter.y * flipProgress * 0.5;
        fromCenter.x -= perspective;

        vec2 warpedUV = center + fromCenter;
        
        // Only sample if in bounds
        if (warpedUV.x >= 0.0 && warpedUV.x <= 1.0 && warpedUV.y >= 0.0 && warpedUV.y <= 1.0) {
            color = texture2D(uMainSampler, warpedUV);
        }

        // Add a "glint" that appears as the card is edge-on
        float glint = pow(flipProgress, 10.0);
        color.rgb += vec3(1.0, 1.0, 0.9) * glint * 0.5;

        // Add a subtle darkening effect as it turns
        color.rgb *= (1.0 - flipProgress * 0.3);
    }
    
    if (hovering > 0.5) {
        // Calculate distance from center
        vec2 center = vec2(0.5, 0.5);
        vec2 fromCenter = uv - center;
        
        // 3D perspective distortion based on mouse position
        vec2 mouseNorm = mouseScreenPos / 2000.0; // Normalize mouse position
        
        // Create depth illusion with perspective distortion
        float depth = 0.1 * sin(time * 2.0 + length(fromCenter) * 10.0);
        vec2 perspective = fromCenter * (1.0 + depth + mouseNorm.x * 0.1);
        vec2 distortedUV = center + perspective;
        
        // Sample with distortion
        if (distortedUV.x >= 0.0 && distortedUV.x <= 1.0 && distortedUV.y >= 0.0 && distortedUV.y <= 1.0) {
            color = texture2D(uMainSampler, distortedUV);
        }
        
        // Add metallic highlight effect
        float highlight = 1.0 - length(fromCenter - mouseNorm * 0.2);
        highlight = pow(max(0.0, highlight), 3.0);
        
        // Add subtle color shift for metallic look
        color.rgb += vec3(highlight * 0.3, highlight * 0.2, highlight * 0.1);
        
        // Add rim lighting effect
        float rim = 1.0 - dot(normalize(fromCenter), vec2(0.0, 1.0));
        rim = pow(rim, 2.0);
        color.rgb += vec3(rim * 0.2, rim * 0.3, rim * 0.4) * hovering;
        
        // Add subtle chromatic aberration
        float aberration = length(fromCenter) * 0.01;
        color.r = texture2D(uMainSampler, distortedUV + vec2(aberration, 0.0)).r;
        color.b = texture2D(uMainSampler, distortedUV - vec2(aberration, 0.0)).b;
    }
    
    gl_FragColor = color;
}`
    })
  }
}

export class CardSprite extends Phaser.GameObjects.Container {
  public static readonly CARD_WIDTH = 43
  public static readonly CARD_HEIGHT = 60
  
  private card: Card
  private cardState: CardState = CardState.INITIALIZE
  private cardBackground!: Phaser.GameObjects.Image
  private cardArt!: Phaser.GameObjects.Image
  private nameText!: Phaser.GameObjects.Text
  private descriptionText!: Phaser.GameObjects.Text
  
  // Card printing elements
  private printedTextElements: Phaser.GameObjects.Text[] = []
  
  // Dragging
  private isDragging = false
  private dragOffsetX = 0
  private dragOffsetY = 0
  
  // Animation and effects - Godot-inspired
  private isSelected = false
  private isHovered = false
  private highlightTimer = 0
  private rotationTween?: Phaser.Tweens.Tween
  private shakeTween?: Phaser.Tweens.Tween
  private moveTween?: Phaser.Tweens.Tween
  private fadeTimer = 0
  
  // Flip animation properties
  private isFlipped = false
  private flipTween?: Phaser.Tweens.Tween
  private isFlipping = false
  
  // Mouse tracking and smooth movement (Godot-inspired)
  private TIME = 0
  // private mousePos = { x: 0, y: 0 }
  private velocity = { x: 0, y: 0 }
  private lastMousePos = { x: 0, y: 0 }
  // private oldPos = { x: 0, y: 0 }
  private oldPos2 = { x: 0, y: 0 }
  // private velDir = { x: 0, y: 0 }
  private velDir2 = { x: 0, y: 0 }
  private currentRotation = 0
  private currentScale = 1
  private normalPosition = { x: 0, y: 0 }
  private enabled = true
  private randomOffset = 0
  
  // Shader system
  private hoverShader?: Phaser.Renderer.WebGL.Pipelines.PostFXPipeline
  private shaderUniforms = {
    hovering: 0,
    mouseScreenPos: [0.0, 0.0],
    time: 0.0,
    cardSize: [CardSprite.CARD_WIDTH, CardSprite.CARD_HEIGHT],
    flipProgress: 0.0
  }
  
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
    this.normalPosition = { x, y }
    this.randomOffset = Math.random() * 1000
    
    // Enable interactive for dragging
    this.setSize(CardSprite.CARD_WIDTH, CardSprite.CARD_HEIGHT)
    this.setInteractive({ draggable: true })
    
    this.createCardElements()
    this.setupEventListeners()
    this.setupMouseTracking()
    
    // Start with initialization animation
    this.transitionTo(CardState.INITIALIZE)
    
    scene.add.existing(this)
  }
  
  private createCardElements(): void {
    // Calculate offset to center child elements around container origin
    const offsetX = -CardSprite.CARD_WIDTH / 2
    const offsetY = -CardSprite.CARD_HEIGHT / 2
    
    // Initialize 3D hover shader
    this.initializeShader()
    
    // Card background
    this.cardBackground = this.scene.add.image(offsetX, offsetY, 'card-back')
    this.cardBackground.setOrigin(0, 0)
    this.add(this.cardBackground)
    
    // Card art (will be added after background loads)
    this.cardArt = this.scene.add.image(offsetX + 3, offsetY + 8, 'card-art')
    this.cardArt.setOrigin(0, 0)
    this.cardArt.setFrame(this.card.artIndex)
    this.cardArt.setVisible(false) // Hidden initially during fade-in
    this.add(this.cardArt)
    
    // Apply shader to card elements for 3D effects
    if (this.hoverShader) {
      this.cardBackground.setPipeline(this.hoverShader)
      this.cardArt.setPipeline(this.hoverShader)
    }
    
    // Print the card with advanced text rendering
    this.printCard()
    
    // Description text
    this.descriptionText = this.scene.add.text(offsetX + 21, offsetY + 35, this.card.description, {
      ...getFontStyle('retro', 3),
      color: '#cccccc',
      wordWrap: { width: 38, useAdvancedWrap: true }
    })
    this.descriptionText.setOrigin(0.5, 0)
    this.add(this.descriptionText)
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
  
  private initializeShader(): void {
    // Register and create the 3D hover shader
    const renderer = this.scene.game.renderer
    
    if (renderer.type === Phaser.WEBGL) {
      const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer
      const pipelineManager = webglRenderer.pipelines
      
      if (pipelineManager && !pipelineManager.get('Card3DHover')) {
        pipelineManager.add('Card3DHover', new Card3DHoverShader(this.scene.game))
      }
      
      this.hoverShader = pipelineManager?.get('Card3DHover') as Phaser.Renderer.WebGL.Pipelines.PostFXPipeline
    }
  }

  private setupMouseTracking(): void {
    // Set up global mouse tracking for velocity calculation
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled) return
      
      const deltaTime = this.scene.game.loop.delta / 1000
      const currentMousePos = { x: pointer.x, y: pointer.y }
      
      // Calculate velocity
      if (deltaTime > 0) {
        this.velocity.x = (currentMousePos.x - this.lastMousePos.x) / (deltaTime * 4000)
        this.velocity.y = (currentMousePos.y - this.lastMousePos.y) / (deltaTime * 4000)
        
        // Clamp velocity
        this.velocity.x = Phaser.Math.Clamp(this.velocity.x, -0.3, 0.3)
        this.velocity.y = Phaser.Math.Clamp(this.velocity.y, -0.3, 0.3)
      }
      
      this.lastMousePos = currentMousePos
      
      // Mouse position tracking for potential future use
      // const cardCenter = {
      //   x: this.x + CardSprite.CARD_WIDTH / 2,
      //   y: this.y + CardSprite.CARD_HEIGHT / 2
      // }
      // this.mousePos = {
      //   x: pointer.x - cardCenter.x,
      //   y: pointer.y - cardCenter.y
      // }
    })
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
    
    // Stop any movement tweens for manual control
    if (this.moveTween) {
      this.moveTween.stop()
      this.moveTween = undefined
    }
  }
  
  private onDrag(_pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return
    
    // Smooth following like in Godot (handled in update method)
    // The actual position update happens in the update method for smooth lerp
  }
  
  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    this.isDragging = false
    this.setDepth(this.index)
    this.removeShadowEffect()
    
    // Check for zone snap
    const snapResult = this.snapToZone(pointer.x, pointer.y)
    
    if (!snapResult.snapped) {
      // Will return to normal position in update method
    }
  }
  
  private onPointerOver(): void {
    if (this.cardState !== CardState.ACTIVE || this.isDragging) return
    
    this.isHovered = true
    this.highlightTimer = 0
    
    // Hover effects now handled in update method for smooth Godot-style behavior
  }
  
  private onPointerOut(): void {
    this.isHovered = false
    
    // Stop any existing rotation tweens as update method handles rotation
    if (this.rotationTween) {
      this.rotationTween.stop()
      this.rotationTween = undefined
    }
  }
  
  private onPointerDown(): void {
    if (this.cardState !== CardState.ACTIVE || this.isDragging) return
    // Handle selection logic here if needed
  }
  
  private onPointerUp(): void {
    if (this.cardState !== CardState.ACTIVE || this.isDragging || this.isFlipping) return
    
    // Quick click = flip the card for demo purposes
    this.flipCard()
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
      .with([CardState.ACTIVE, CardState.FLIPPED], () => {
        this.startFlipAnimation()
      })
      .with([CardState.FLIPPED, CardState.ACTIVE], () => {
        this.startFlipAnimation()
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
  
  private isCursorTouching(): boolean {
    // Get the mouse position in global coordinates
    const mousePos = this.scene.input.activePointer
    if (!mousePos) return false
    
    const bounds = this.getBounds()
    return bounds.contains(mousePos.x, mousePos.y)
  }
  
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor
  }
  
  private lerpVector(start: { x: number, y: number }, end: { x: number, y: number }, factor: number): { x: number, y: number } {
    return {
      x: this.lerp(start.x, end.x, factor),
      y: this.lerp(start.y, end.y, factor)
    }
  }
  
  private applyHoverShader(hovering: boolean): void {
    // Apply real 3D shader effects like the Godot version
    if (this.hoverShader) {
      // Update shader uniforms exactly like Godot
      this.shaderUniforms.hovering = hovering ? 1.0 : 0.0
      this.shaderUniforms.time = this.TIME + this.randomOffset
      
      if (hovering) {
        const pointer = this.scene.input.activePointer
        if (pointer) {
          const cardCenter = {
            x: this.x + CardSprite.CARD_WIDTH / 2,
            y: this.y + CardSprite.CARD_HEIGHT / 2
          }
          
          // Calculate mouse position exactly like Godot version with same clamping
          const value = 2000
          const mouseRelative = {
            x: Phaser.Math.Clamp((pointer.x - cardCenter.x) * 2, -value, value),
            y: Phaser.Math.Clamp((pointer.y - cardCenter.y) * 2, -value, value)
          }
          
          this.shaderUniforms.mouseScreenPos = [mouseRelative.x, mouseRelative.y]
        }
      } else {
        this.shaderUniforms.mouseScreenPos = [0.0, 0.0]
      }
      
      // Apply uniforms to shader
      try {
        this.hoverShader.set1f('hovering', this.shaderUniforms.hovering)
        this.hoverShader.set2f('mouseScreenPos', this.shaderUniforms.mouseScreenPos[0], this.shaderUniforms.mouseScreenPos[1])
        this.hoverShader.set1f('time', this.shaderUniforms.time)
        this.hoverShader.set2f('cardSize', this.shaderUniforms.cardSize[0], this.shaderUniforms.cardSize[1])
        this.hoverShader.set1f('flipProgress', this.shaderUniforms.flipProgress)
      } catch (e) {
        // Fallback for when shader isn't available
        console.warn('Shader uniforms could not be set:', e)
      }
    }
  }
  
  public updatePosition(index: number, targetX: number, targetY: number): void {
    this.index = index
    this.targetX = targetX
    this.targetY = targetY
    this.normalPosition = { x: targetX, y: targetY }
    this.setDepth(index)
    
    // Position updates now handled smoothly in the update method
    // No need for immediate tweening as the Godot-inspired system handles it
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
    if (!this.enabled) {
      this.x = this.normalPosition.x
      this.y = this.normalPosition.y
      this.rotation = 0
      this.setVisible(false)
      return
    }
    
    this.setVisible(true)
    this.TIME += delta / 1000 // Convert to seconds like Godot
    
    const pointer = this.scene.input.activePointer
    const currentPos = { x: this.x, y: this.y }
    
    if (this.isDragging && pointer) {
      // When dragging: smooth follow mouse with lerp (like Godot)
      const targetPos = {
        x: pointer.x - this.dragOffsetX,
        y: pointer.y - this.dragOffsetY
      }
      
      const newPos = this.lerpVector(currentPos, targetPos, 0.25)
      this.x = newPos.x
      this.y = newPos.y
      
      // Rotation based on velocity when dragging
      this.currentRotation += Phaser.Math.Clamp(this.velocity.x, -0.3, 0.3)
      this.currentRotation *= 0.8 // Rotation decay like Godot
      
      // Scale up when dragging
      this.currentScale = this.lerp(this.currentScale, 1.05, 0.25)
      
      // this.oldPos = { x: this.x, y: this.y }
      this.velocity.x = 0
      this.velocity.y = 0
    } else {
      // When not dragging: return to normal position with smooth animations
      if (!this.isFlipping) {
        const newPos = this.lerpVector(currentPos, this.normalPosition, 0.25)
        this.x = newPos.x
        this.y = newPos.y
      }
      
      // Calculate velocity for rotation based on movement
      this.velDir2.x = (this.x - this.oldPos2.x) * 0.01532
      this.velDir2.y = (this.y - this.oldPos2.y) * 0.01532
      this.oldPos2 = { x: this.x, y: this.y }
      
      // Apply velocity-based rotation
      this.currentRotation += Phaser.Math.Clamp(this.velDir2.x, -0.3, 0.25)
      this.currentRotation *= 0.8
      
      // Add subtle oscillating rotation (like Godot sine wave)
      this.currentRotation += Math.sin(this.TIME + 1321 + this.randomOffset) * (0.003625 / 2)
      
      // Add subtle oscillating position movement
      this.x += Math.cos(this.TIME + 180 + 1321 + this.randomOffset) * (0.875 / 2)
      this.y += Math.sin(this.TIME + 360 + 1231 + this.randomOffset) * (0.875 / 2)
      
      // Handle hover effects and shaders
      if (this.isCursorTouching() && this.enabled && this.cardState === CardState.ACTIVE) {
        // Scale up when hovering
        this.currentScale = this.lerp(this.currentScale, 1.05, 0.25)
        
        // Apply shader effects for hovering
        this.applyHoverShader(true)
      } else {
        // Scale back to normal
        this.currentScale = this.lerp(this.currentScale, 1.0, 0.25)
        
        // Remove hover shader effects
        this.applyHoverShader(false)
      }
    }
    
    // Apply rotation and scale
    this.rotation = this.currentRotation
    
    if (this.isFlipping) {
      this.scaleY = this.currentScale
      // scaleX is being controlled by the flipTween
    } else {
      this.setScale(this.currentScale)
    }
    
    // Legacy update logic
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
    if (this.flipTween) this.flipTween.stop()
    
    super.destroy(fromScene)
  }

  /**
   * Determines if tokens from a word can be printed based on length constraints
   */
  private getPrintableTokens(word: string): PrintableTokens {
    if (word.length <= 9) {
      return { tokens: [word], canPrint: true }
    }
    
    if (!word.includes(' ')) {
      return { tokens: [], canPrint: false }
    }
    
    const tokens = word.split(' ')
    if (tokens.length > 2) {
      return { tokens: [], canPrint: false }
    }
    
    const allTokensPrintable = tokens.every(token => token.length <= 9)
    if (!allTokensPrintable) {
      return { tokens: [], canPrint: false }
    }
    
    return { tokens, canPrint: true }
  }

  /**
   * Gets text rendering configuration based on word length
   */
  private getTextRenderConfig(wordLength: number): TextRenderConfig {
    if (wordLength <= 5) {
      return { compression: 0, yMultiplier: 9, skip: false }
    } else if (wordLength <= 7) {
      return { compression: 1, yMultiplier: 8, skip: false }
    } else if (wordLength <= 9) {
      return { compression: 2, yMultiplier: 6, skip: false }
    } else {
      return { compression: 0, yMultiplier: 0, skip: true }
    }
  }

  /**
   * Renders serif text with shadow effect similar to Python version
   */
  private renderSerifText(
    character: string, 
    x: number, 
    y: number, 
    compression: number,
    rot180: boolean = false
  ): void {
    const adjustedChar = compression <= 0 ? character.toUpperCase() : character.toLowerCase()
    
    // Calculate offset to center child elements around container origin
    const offsetX = -CardSprite.CARD_WIDTH / 2
    const offsetY = -CardSprite.CARD_HEIGHT / 2
    
    // Create shadow/outline effect by rendering text in multiple positions
    const shadowOffsets = [
      { x: -1, y: 0 }, { x: 1, y: 0 }, 
      { x: 0, y: -1 }, { x: 0, y: 1 }
    ]
    
    const fontSize = compression >= 2 ? 4 : (compression >= 1 ? 5 : 6)
    
    // Render shadow text (dark outline)
    shadowOffsets.forEach(offset => {
      const shadowText = this.scene.add.text(
        offsetX + x + offset.x, 
        offsetY + y + offset.y, 
        adjustedChar, 
        {
          ...getFontStyle('retro', fontSize),
          color: '#000000'
        }
      )
      shadowText.setOrigin(0.5, 0.5)
      
      if (rot180) {
        shadowText.setRotation(Math.PI)
      }
      
      this.printedTextElements.push(shadowText)
      this.add(shadowText)
    })
    
    // Render main text (light foreground)
    const mainText = this.scene.add.text(offsetX + x, offsetY + y, adjustedChar, {
      ...getFontStyle('retro', fontSize),
      color: '#ffffff'
    })
    mainText.setOrigin(0.5, 0.5)
    
    if (rot180) {
      mainText.setRotation(Math.PI)
    }
    
    this.printedTextElements.push(mainText)
    this.add(mainText)
  }

  /**
   * Prints text on the card with compression and layout logic
   */
  private printText(singleWord: string, rot180: boolean = false): void {
    const config = this.getTextRenderConfig(singleWord.length)
    
    if (config.skip) {
      return
    }
    
    for (let i = 0; i < singleWord.length; i++) {
      const char = singleWord[i]
      let yOffset = config.yMultiplier * i + 4
      
      if (config.compression >= 1) {
        yOffset -= 1
      }
      
      let bx = 2
      if (config.compression >= 2) {
        bx += 3 * (i % 2)
      }
      
      this.renderSerifText(char, bx + 5, yOffset, config.compression, rot180)
    }
  }

  /**
   * Renders flashcard-like text layout for simple cards
   */
  private renderFlashcardText(text: string): void {
    // Clear any existing printed text
    this.clearPrintedText()
    
    // Create centered text for flashcard style
    const flashcardText = this.scene.add.text(
      0, // Already centered since container origin is at center
      0, // Already centered since container origin is at center
      text, 
      {
        ...getFontStyle('capitalHill', 5),
        color: '#000000',
        backgroundColor: '#ffffff',
        padding: { x: 2, y: 2 },
        align: 'center',
        wordWrap: { width: CardSprite.CARD_WIDTH - 4, useAdvancedWrap: true }
      }
    )
    flashcardText.setOrigin(0.5, 0.5)
    
    this.printedTextElements.push(flashcardText)
    this.add(flashcardText)
  }

  /**
   * Main card printing method that handles different card types
   */
  private printCard(): void {
    // Clear any existing printed text
    this.clearPrintedText()
    
    const cardName = this.card.name
    
    // Check if this is a flashcard-like card (you might need to implement isFlashcardLike)
    if (this.isFlashcardLike()) {
      this.renderFlashcardText(cardName)
      return
    }
    
    // Handle regular cards with text compression
    const printableResult = this.getPrintableTokens(cardName)
    
    if (printableResult.canPrint) {
      printableResult.tokens.forEach((token, index) => {
        const rot180 = index > 0 // Rotate second token if present
        this.printText(token, rot180)
      })
    }
  }

  /**
   * Determines if the card should be rendered as a flashcard
   */
  private isFlashcardLike(): boolean {
    // This is a placeholder - you might want to add a property to Card type
    // or implement logic based on card properties
    return this.card.name.length > 15 || this.card.description.length > 50
  }

  /**
   * Clears all printed text elements
   */
  private clearPrintedText(): void {
    this.printedTextElements.forEach(textElement => {
      this.remove(textElement)
      textElement.destroy()
    })
    this.printedTextElements = []
  }

  /**
   * Reprints the card (useful for dynamic updates)
   */
  public reprintCard(): void {
    this.printCard()
  }

  /**
   * Enable or disable the Godot-inspired hover effects
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    
    if (!enabled) {
      if (this.flipTween) {
        this.flipTween.stop()
      }
      this.isFlipping = false
      this.shaderUniforms.flipProgress = 0.0

      // Reset to normal state immediately
      this.x = this.normalPosition.x
      this.y = this.normalPosition.y
      this.rotation = 0
      this.setScale(1)
      this.setVisible(false)
      this.applyHoverShader(false)
    }
  }

  /**
   * Get the current enabled state
   */
  public isEnabled(): boolean {
    return this.enabled
  }

  private flipCard(): void {
    if (this.isFlipping) return
    
    // Toggle between active and flipped states
    if (this.cardState === CardState.ACTIVE) {
      this.transitionTo(CardState.FLIPPED)
    } else if (this.cardState === CardState.FLIPPED) {
      this.transitionTo(CardState.ACTIVE)
    }
  }

  private startFlipAnimation(): void {
    if (this.isFlipping) return
    
    this.isFlipping = true
    
    // Stop any existing flip tween
    if (this.flipTween) {
      this.flipTween.stop()
    }

    const originalY = this.y
    const liftAmount = 20

    // Animate the shader's flipProgress from 0 -> 1 -> 0 for the glint effect
    this.scene.tweens.add({
        targets: this.shaderUniforms,
        flipProgress: 1.0,
        duration: 250,
        ease: 'Sine.easeInOut',
        yoyo: true
    });
    
    // Part 1: Lift the card and flip it halfway
    this.flipTween = this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      y: originalY - liftAmount,
      duration: 250,
      ease: 'Power2.easeIn',
      onComplete: () => {
        this.switchCardTexture()

        // Part 2: Complete the flip and settle back down
        this.flipTween = this.scene.tweens.add({
          targets: this,
          scaleX: 1,
          y: originalY,
          duration: 250,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.isFlipping = false
            this.flipTween = undefined
          }
        })
      }
    })
  }

  private switchCardTexture(): void {
    // Toggle between showing card art/text and card back
    this.isFlipped = !this.isFlipped
    
    if (this.isFlipped) {
      // Show card back - hide art and text elements
      this.cardArt.setVisible(false)
      this.descriptionText.setVisible(false)
      this.nameText?.setVisible(false)
      this.printedTextElements.forEach(text => text.setVisible(false))
      
      // Change background to card back texture
      this.cardBackground.setTexture('card-flipped')
    } else {
      // Show card front - show art and text elements
      this.cardArt.setVisible(true)
      this.descriptionText.setVisible(true)
      this.nameText?.setVisible(true)
      this.printedTextElements.forEach(text => text.setVisible(true))
      
      // Change background to card front texture (you might need to adjust this)
      this.cardBackground.setTexture('card-back') // The original background for the front
    }
  }
} 