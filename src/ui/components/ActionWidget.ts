import Phaser from "phaser";
import { Palette } from "@/palette";
import { Hover3DShader, SHADER_KEY as HOVER3D_KEY } from "../../shaders/Hover3DShader";
import { getFontStyle } from "@/fonts";

export interface ActionWidgetConfig {
  x: number;
  y: number;
  iconKey: string;
  iconFrame?: number;
  size?: number;
  label?: string;
  onSelect?: () => void;
  onCancel?: () => void;
}

/**
 * ActionWidget - A non-draggable widget with 3D hover effects for battle action selection.
 * Similar to Pawn but optimized for UI interactions without grid snapping or dragging.
 */
export class ActionWidget extends Phaser.GameObjects.Container {
  public static readonly DEFAULT_SIZE = 16;
  
  private iconSprite!: Phaser.GameObjects.Image;
  private shadowSprite!: Phaser.GameObjects.Image;
  private labelText!: Phaser.GameObjects.Text;
  private labelBackground!: Phaser.GameObjects.Graphics;
  
  // Shader integration
  private hoverShader?: Phaser.Renderer.WebGL.Pipelines.PostFXPipeline;
  private shaderUniforms = {
    hovering: 0,
    mouseScreenPos: [0.0, 0.0] as [number, number],
    time: 0.0,
    objectSize: [ActionWidget.DEFAULT_SIZE, ActionWidget.DEFAULT_SIZE] as [number, number],
    flipProgress: 0.0,
  };
  
  // Visual effects
  private isHovered = false;
  
  // Configuration
  private config: ActionWidgetConfig;
  private widgetSize: number;
  
  constructor(scene: Phaser.Scene, config: ActionWidgetConfig) {
    super(scene, config.x, config.y);
    
    this.config = { ...config };
    this.widgetSize = config.size || ActionWidget.DEFAULT_SIZE;
    
    // Set size for interaction
    this.setSize(this.widgetSize, this.widgetSize);
    this.setInteractive();
    
    this.createWidgetElements();
    this.initializeHoverShader();
    this.setupEventListeners();
    
    scene.add.existing(this);
  }
  
  private createWidgetElements(): void {
    // Create shadow (behind the icon)
    this.shadowSprite = this.scene.add.image(2, 2, this.config.iconKey);
    this.shadowSprite.setOrigin(0.5, 0.5);
    this.shadowSprite.setDisplaySize(this.widgetSize, this.widgetSize);
    this.shadowSprite.setTint(0x000000);
    this.shadowSprite.setAlpha(0.5);
    this.shadowSprite.setVisible(true); // Always show soft shadow
    if (this.config.iconFrame !== undefined) {
      this.shadowSprite.setFrame(this.config.iconFrame);
    }
    this.add(this.shadowSprite);
    
    // Create main icon sprite
    this.iconSprite = this.scene.add.image(0, 0, this.config.iconKey);
    this.iconSprite.setOrigin(0.5, 0.5);
    this.iconSprite.setDisplaySize(this.widgetSize, this.widgetSize);
    if (this.config.iconFrame !== undefined) {
      this.iconSprite.setFrame(this.config.iconFrame);
    }
    this.add(this.iconSprite);
    
    // Create label background (initially hidden)
    this.labelBackground = this.scene.add.graphics();
    this.labelBackground.setVisible(false);
    this.add(this.labelBackground);
    
    // Create label text (initially hidden)
    this.labelText = this.scene.add.text(this.widgetSize / 2 + 3, 0, this.config.label || "", {
      ...getFontStyle("everydayStandard"),
      color: Palette.WHITE.hex,
      align: "left"
    });
    this.labelText.setOrigin(0, 0.5); // Left-center origin
    this.labelText.setVisible(false);
    this.add(this.labelText);
    
    // Update shader uniforms for correct size
    this.shaderUniforms.objectSize = [this.widgetSize, this.widgetSize];
  }
  
  private initializeHoverShader(): void {
    const renderer = this.scene.game.renderer;
    if (renderer.type === Phaser.WEBGL) {
      const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      const pipelineManager = webglRenderer.pipelines;

      if (pipelineManager && !pipelineManager.get(HOVER3D_KEY)) {
        pipelineManager.addPostPipeline(HOVER3D_KEY, Hover3DShader);
      }

      this.hoverShader = pipelineManager.get(HOVER3D_KEY) as Phaser.Renderer.WebGL.Pipelines.PostFXPipeline;
    }

    if (this.hoverShader) {
      this.iconSprite.setPipeline(this.hoverShader);
    }
  }
  
  private setupEventListeners(): void {
    // Hover events
    this.on("pointerover", this.onPointerOver, this);
    this.on("pointerout", this.onPointerOut, this);
    this.on("pointerdown", this.onPointerDown, this);
    this.on("pointerup", this.onPointerUp, this);
  }
  
  private onPointerOver(): void {
    this.isHovered = true;
    
    // Enhance shadow on hover
    this.shadowSprite.setAlpha(0.8);
    
    // Show label with background
    if (this.config.label) {
      this.showLabel();
    }
    
    // Subtle tint on icon
    this.iconSprite.setTint(0xffffcc);
  }
  
  private onPointerOut(): void {
    this.isHovered = false;
    
    // Reset shadow
    this.shadowSprite.setAlpha(0.5);
    
    // Hide label
    this.hideLabel();
    
    // Remove icon tint
    this.iconSprite.clearTint();
  }
  
  private onPointerDown(): void {
    // Visual feedback for press
    this.setDepth(1000); // Bring to front
  }
  
  private onPointerUp(): void {
    // Reset depth
    this.setDepth(0);
    
    // Trigger selection callback
    if (this.config.onSelect) {
      this.config.onSelect();
    }
  }
  
  private showLabel(): void {
    if (!this.config.label) return;
    
    // Calculate label size
    const textBounds = this.labelText.getBounds();
    const padding = 3;
    const bgWidth = textBounds.width + padding * 2;
    const bgHeight = 10; // Fixed height for ribbon look
    const startX = this.widgetSize / 2 + 1; // Start from edge of icon
    
    // Reset label position
    this.labelText.setPosition(startX + padding, 0);
    
    // Show elements but start invisible
    this.labelBackground.setVisible(true);
    this.labelText.setVisible(true);
    this.labelBackground.setAlpha(1);
    this.labelText.setAlpha(0);
    
    // Create ribbon expansion effect - start with zero width
    this.labelBackground.clear();
    this.labelBackground.fillStyle(0x000000, 0.9);
    this.labelBackground.lineStyle(1, Palette.WHITE.num, 0.8);
    this.labelBackground.fillRoundedRect(startX, -bgHeight / 2, 0, bgHeight, bgHeight / 2);
    this.labelBackground.strokeRoundedRect(startX, -bgHeight / 2, 0, bgHeight, bgHeight / 2);
    
    // Animate ribbon expanding to the right
    this.scene.tweens.add({
      targets: { width: 0 },
      width: bgWidth,
      duration: 200,
      ease: "Back.easeOut",
      onUpdate: (tween) => {
        const currentWidth = tween.targets[0].width;
        this.labelBackground.clear();
        this.labelBackground.fillStyle(0x000000, 0.9);
        this.labelBackground.lineStyle(1, Palette.WHITE.num, 0.8);
        this.labelBackground.fillRoundedRect(startX, -bgHeight / 2, currentWidth, bgHeight, 2);
        this.labelBackground.strokeRoundedRect(startX, -bgHeight / 2, currentWidth, bgHeight, 2);
      }
    });
    
    // Fade in text after ribbon starts expanding
    this.scene.tweens.add({
      targets: this.labelText,
      alpha: 1,
      duration: 150,
      delay: 50,
      ease: "Power2"
    });
  }
  
  private hideLabel(): void {
    // Quickly fade out and hide
    this.scene.tweens.add({
      targets: [this.labelBackground, this.labelText],
      alpha: 0,
      duration: 100,
      ease: "Power2",
      onComplete: () => {
        this.labelBackground.setVisible(false);
        this.labelText.setVisible(false);
        this.labelBackground.clear();
      }
    });
  }
  
  public update(time: number, delta: number): void {
    // Add subtle idle animation
    if (!this.isHovered) {
      const idleOffset = Math.sin(time * 0.003 + this.x * 0.01) * 0.5;
      this.y = this.config.y + idleOffset;
    }

    // ---------------- Shader uniform updates ----------------
    if (this.hoverShader) {
      // Advance time uniform (seconds)
      this.shaderUniforms.time += delta / 1000;

      const pointer = this.scene.input.activePointer;
      const hoveringNow = this.isHovered;
      this.shaderUniforms.hovering = hoveringNow ? 1 : 0;

      if (hoveringNow && pointer) {
        const value = 2000;
        const mouseRelativeX = Phaser.Math.Clamp((pointer.x - this.x) * 2, -value, value);
        const mouseRelativeY = Phaser.Math.Clamp((pointer.y - this.y) * 2, -value, value);
        this.shaderUniforms.mouseScreenPos = [mouseRelativeX, mouseRelativeY];
      } else {
        this.shaderUniforms.mouseScreenPos = [0.0, 0.0];
      }

      try {
        this.hoverShader.set1f("hovering", this.shaderUniforms.hovering);
        this.hoverShader.set2f(
          "mouseScreenPos",
          this.shaderUniforms.mouseScreenPos[0],
          this.shaderUniforms.mouseScreenPos[1]
        );
        this.hoverShader.set1f("time", this.shaderUniforms.time);
        this.hoverShader.set2f("cardSize", this.shaderUniforms.objectSize[0], this.shaderUniforms.objectSize[1]);
        this.hoverShader.set1f("flipProgress", this.shaderUniforms.flipProgress);
      } catch (e) {
        // Shader might not be ready or WebGL unavailable – fail silently
      }
    }
  }
  
  public setIcon(iconKey: string, iconFrame?: number): void {
    this.config.iconKey = iconKey;
    this.config.iconFrame = iconFrame;
    
    this.iconSprite.setTexture(iconKey);
    this.shadowSprite.setTexture(iconKey);
    
    if (iconFrame !== undefined) {
      this.iconSprite.setFrame(iconFrame);
      this.shadowSprite.setFrame(iconFrame);
    }
  }
  
  public setPosition(x: number, y: number): this {
    if (this.config) {
      this.config.x = x;
      this.config.y = y;
    }
    return super.setPosition(x, y);
  }
  
  destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
  }
}