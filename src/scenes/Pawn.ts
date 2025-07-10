import Phaser from "phaser";
import { Palette } from "../palette";
import type { Grid } from "../grid/Grid";
import { Hover3DShader, SHADER_KEY as HOVER3D_KEY } from "../shaders/Hover3DShader";

export class Pawn extends Phaser.GameObjects.Container {
  public static readonly PAWN_SIZE = 24;
  
  private pawnSprite!: Phaser.GameObjects.Image;
  private shadowSprite!: Phaser.GameObjects.Image;
  private grid: Grid;
  private gridSize: number;
  
  // Shader integration
  private hoverShader?: Phaser.Renderer.WebGL.Pipelines.PostFXPipeline;
  private shaderUniforms = {
    hovering: 0,
    mouseScreenPos: [0.0, 0.0] as [number, number],
    time: 0.0,
    objectSize: [Pawn.PAWN_SIZE, Pawn.PAWN_SIZE] as [number, number],
    flipProgress: 0.0,
  };
  
  // Dragging state
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private startDragX = 0;
  private startDragY = 0;
  
  // Visual effects
  private isHovered = false;
  private currentScale = 1;
  private targetScale = 1;
  private currentRotation = 0;
  private shadowTween?: Phaser.Tweens.Tween;
  
  // Grid position
  private gridX: number;
  private gridY: number;
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    grid: Grid,
    portraitFrame: number = 0
  ) {
    super(scene, x, y);
    
    this.grid = grid;
    this.gridSize = grid.getGridSize();
    
    // Convert world position to grid coordinates
    this.gridX = Math.round(x / this.gridSize) * this.gridSize;
    this.gridY = Math.round(y / this.gridSize) * this.gridSize;
    
    // Set size for interaction
    this.setSize(Pawn.PAWN_SIZE, Pawn.PAWN_SIZE);
    this.setInteractive({ draggable: true });
    
    this.createPawnElements(portraitFrame);
    this.initializeHoverShader();
    this.setupEventListeners();
    
    // Initial position snap to grid
    this.snapToGrid();
    
    scene.add.existing(this);
  }
  
  private createPawnElements(portraitFrame: number): void {
    // Create shadow (behind the pawn)
    this.shadowSprite = this.scene.add.image(2, 2, "portrait");
    this.shadowSprite.setOrigin(0.5, 0.5);
    this.shadowSprite.setDisplaySize(Pawn.PAWN_SIZE, Pawn.PAWN_SIZE);
    this.shadowSprite.setTint(0x000000);
    this.shadowSprite.setAlpha(0.3);
    this.shadowSprite.setVisible(false);
    this.add(this.shadowSprite);
    
    // Create main pawn sprite
    this.pawnSprite = this.scene.add.image(0, 0, "portrait");
    this.pawnSprite.setOrigin(0.5, 0.5);
    this.pawnSprite.setDisplaySize(Pawn.PAWN_SIZE, Pawn.PAWN_SIZE);
    this.pawnSprite.setFrame(portraitFrame);
    this.add(this.pawnSprite);
    
    // Add subtle border
    const borderGraphics = this.scene.add.graphics();
    borderGraphics.lineStyle(1, Palette.WHITE.num, 0.8);
    borderGraphics.strokeCircle(0, 0, Pawn.PAWN_SIZE / 2);
    this.add(borderGraphics);
  }
  
  private initializeHoverShader(): void {
    const renderer = this.scene.game.renderer;
    if (renderer.type === Phaser.WEBGL) {
      const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      const pipelineManager = webglRenderer.pipelines;

      if (pipelineManager && !pipelineManager.get(HOVER3D_KEY)) {
        pipelineManager.add(HOVER3D_KEY, new Hover3DShader(this.scene.game));
      }

      this.hoverShader = pipelineManager.get(HOVER3D_KEY) as Phaser.Renderer.WebGL.Pipelines.PostFXPipeline;
    }

    if (this.hoverShader) {
      this.pawnSprite.setPipeline(this.hoverShader);
    }
  }
  
  private setupEventListeners(): void {
    // Drag events
    this.on("dragstart", this.onDragStart, this);
    this.on("drag", this.onDrag, this);
    this.on("dragend", this.onDragEnd, this);
    
    // Hover events
    this.on("pointerover", this.onPointerOver, this);
    this.on("pointerout", this.onPointerOut, this);
  }
  
  private onDragStart(pointer: Phaser.Input.Pointer): void {
    this.isDragging = true;
    this.startDragX = this.x;
    this.startDragY = this.y;
    this.dragOffsetX = pointer.x - this.x;
    this.dragOffsetY = pointer.y - this.y;
    
    // Visual feedback
    this.setDepth(1000); // Bring to front
    this.targetScale = 1.2;
    this.currentRotation = 0;
    
    // Show shadow
    this.shadowSprite.setVisible(true);
    this.animateShadow(true);
  }
  
  private onDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;
    
    // Update position
    this.x = pointer.x - this.dragOffsetX;
    this.y = pointer.y - this.dragOffsetY;
    
    // Add slight rotation based on movement
    const deltaX = pointer.x - pointer.prevPosition.x;
    this.currentRotation += deltaX * 0.01;
    this.currentRotation *= 0.9; // Decay
    this.rotation = this.currentRotation;
  }
  
  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    this.isDragging = false;
    this.setDepth(0);
    this.targetScale = this.isHovered ? 1.1 : 1.0;
    
    // Hide shadow
    this.animateShadow(false);
    
    // Try to snap to a valid grid position
    const snapResult = this.trySnapToGrid(pointer.x, pointer.y);
    
    if (snapResult.success) {
      // Successful snap
      this.smoothMoveTo(snapResult.x, snapResult.y);
      this.gridX = snapResult.gridX;
      this.gridY = snapResult.gridY;
    } else {
      // Return to original position
      this.smoothMoveTo(this.startDragX, this.startDragY);
    }
    
    // Reset rotation
    this.scene.tweens.add({
      targets: this,
      rotation: 0,
      duration: 300,
      ease: "Back.easeOut"
    });
  }
  
  private onPointerOver(): void {
    if (this.isDragging) return;
    
    this.isHovered = true;
    this.targetScale = 1.1;
    
    // Subtle highlight
    this.pawnSprite.setTint(0xffffcc);
  }
  
  private onPointerOut(): void {
    this.isHovered = false;
    this.targetScale = 1.0;
    
    // Remove highlight
    this.pawnSprite.clearTint();
  }
  
  private trySnapToGrid(worldX: number, worldY: number): {
    success: boolean;
    x: number;
    y: number;
    gridX: number;
    gridY: number;
  } {
    // Convert world coordinates to grid coordinates
    const gridX = Math.round(worldX / this.gridSize) * this.gridSize;
    const gridY = Math.round(worldY / this.gridSize) * this.gridSize;
    
    // Check if this position is within any active region
    const cellKey = `${gridX},${gridY}`;
    const isInActiveRegion = this.grid.getActiveCells().has(cellKey);
    
    if (isInActiveRegion) {
      // Check if position is already occupied by another pawn
      const isOccupied = this.isPositionOccupied(gridX, gridY);
      
      if (!isOccupied) {
        return {
          success: true,
          x: gridX,
          y: gridY,
          gridX,
          gridY
        };
      }
    }
    
    return {
      success: false,
      x: this.startDragX,
      y: this.startDragY,
      gridX: this.gridX,
      gridY: this.gridY
    };
  }
  
  private isPositionOccupied(gridX: number, gridY: number): boolean {
    // Check if any other pawn is at this position
    // This would need to be implemented by the scene managing multiple pawns
    return false; // For now, allow any position
  }
  
  private smoothMoveTo(x: number, y: number): void {
    this.scene.tweens.add({
      targets: this,
      x: x,
      y: y,
      duration: 300,
      ease: "Back.easeOut"
    });
  }
  
  private animateShadow(show: boolean): void {
    if (this.shadowTween) {
      this.shadowTween.stop();
    }
    
    this.shadowTween = this.scene.tweens.add({
      targets: this.shadowSprite,
      alpha: show ? 0.5 : 0.0,
      scaleX: show ? 1.2 : 1.0,
      scaleY: show ? 1.2 : 1.0,
      duration: 200,
      ease: "Power2",
      onComplete: () => {
        if (!show) {
          this.shadowSprite.setVisible(false);
        }
      }
    });
  }
  
  private snapToGrid(): void {
    // Snap to current grid position
    this.x = this.gridX;
    this.y = this.gridY;
  }
  
  public update(time: number, delta: number): void {
    // Smooth scale animation
    if (Math.abs(this.currentScale - this.targetScale) > 0.01) {
      this.currentScale = Phaser.Math.Linear(this.currentScale, this.targetScale, 0.1);
      this.setScale(this.currentScale);
    }
    
    // Add subtle idle animation
    if (!this.isDragging && !this.isHovered) {
      const idleOffset = Math.sin(time * 0.002) * 0.5;
      this.y = this.gridY + idleOffset;
    }

    // ---------------- Shader uniform updates ----------------
    if (this.hoverShader) {
      // Advance time uniform (seconds)
      this.shaderUniforms.time += delta / 1000;

      const pointer = this.scene.input.activePointer;
      const hoveringNow = this.isHovered || this.isDragging;
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
  
  public getGridPosition(): { x: number; y: number } {
    return { x: this.gridX, y: this.gridY };
  }
  
  public setGridPosition(gridX: number, gridY: number): void {
    this.gridX = gridX;
    this.gridY = gridY;
    this.snapToGrid();
  }
  
  public setOccupancyChecker(checker: (x: number, y: number, excludePawn?: Pawn) => boolean): void {
    this.isPositionOccupied = (gridX: number, gridY: number) => {
      return checker(gridX, gridY, this);
    };
  }
  
  destroy(fromScene?: boolean): void {
    if (this.shadowTween) {
      this.shadowTween.stop();
    }
    super.destroy(fromScene);
  }
} 