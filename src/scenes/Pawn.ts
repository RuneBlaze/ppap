import Phaser from "phaser";
import { Palette } from "../palette";
import {
	SHADER_KEY as HOVER3D_KEY,
	Hover3DShader,
} from "../shaders/Hover3DShader";

export class Pawn extends Phaser.GameObjects.Container {
	public static readonly PAWN_SIZE = 24;

	private pawnSprite!: Phaser.GameObjects.Image;
	private shadowSprite!: Phaser.GameObjects.Image;
	private gridSize: number;
	public readonly id: string;

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
	// Removed unused start drag anchors due to decoupled state model

	// Visual effects
	private isHovered = false;
	private currentScale = 1;
	private targetScale = 1;
	private currentRotation = 0;
	private shadowTween?: Phaser.Tweens.Tween;

	// Committed grid-centered position (in world pixels)
	private committedCenterX: number;
	private committedCenterY: number;

	constructor(
		scene: Phaser.Scene,
		params: {
			id: string;
			intersectionX: number; // discrete grid intersection coords
			intersectionY: number;
			gridSize: number;
			portraitFrame?: number;
		},
	) {
		super(scene, 0, 0);

		this.id = params.id;
		this.gridSize = params.gridSize;

		// Compute committed center position from intersection
		this.committedCenterX = params.intersectionX + this.gridSize / 2;
		this.committedCenterY = params.intersectionY + this.gridSize / 2;

		// Set size for interaction
		this.setSize(Pawn.PAWN_SIZE, Pawn.PAWN_SIZE);
		this.setInteractive({ draggable: true });

		this.createPawnElements(params.portraitFrame ?? 0);
		this.initializeHoverShader();
		this.setupEventListeners();

		// Initial position at committed center
		this.x = this.committedCenterX;
		this.y = this.committedCenterY;

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
		// borderGraphics.strokeCircle(0, 0, Pawn.PAWN_SIZE / 2);
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

			this.hoverShader = pipelineManager.get(
				HOVER3D_KEY,
			) as Phaser.Renderer.WebGL.Pipelines.PostFXPipeline;
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

		// Propose a move based on nearest grid intersection; controller will decide.
		const proposedIntersectionX =
			Math.round(pointer.x / this.gridSize) * this.gridSize;
		const proposedIntersectionY =
			Math.round(pointer.y / this.gridSize) * this.gridSize;

		this.emit("moveRequested", {
			pawnId: this.id,
			to: { x: proposedIntersectionX, y: proposedIntersectionY },
			from: {
				x: this.committedCenterX - this.gridSize / 2,
				y: this.committedCenterY - this.gridSize / 2,
			},
		});

		// Reset rotation
		this.scene.tweens.add({
			targets: this,
			rotation: 0,
			duration: 300,
			ease: "Back.easeOut",
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

	// Controller API: animate to newly committed intersection and store as committed
	public applyCommittedIntersection(intersectionX: number, intersectionY: number) {
		this.committedCenterX = intersectionX + this.gridSize / 2;
		this.committedCenterY = intersectionY + this.gridSize / 2;
		this.smoothMoveTo(this.committedCenterX, this.committedCenterY);
	}

	// Controller API: revert visual position to last committed center
	public revertToCommitted() {
		this.smoothMoveTo(this.committedCenterX, this.committedCenterY);
	}

	private smoothMoveTo(x: number, y: number): void {
		this.scene.tweens.add({
			targets: this,
			x: x,
			y: y,
			duration: 300,
			ease: "Back.easeOut",
		});
	}

	private animateShadow(show: boolean): void {
		if (this.shadowTween) {
			this.shadowTween.stop();
		}

		this.shadowTween = this.scene.tweens.add({
			targets: this.shadowSprite,
			alpha: show ? 0.5 : 0.0,
			// Remove shadow scaling - container scaling already handles the "lift" effect
			duration: 200,
			ease: "Power2",
			onComplete: () => {
				if (!show) {
					this.shadowSprite.setVisible(false);
				}
			},
		});
	}

	// Method kept for API completeness if needed later
	// private snapToCommitted(): void {}

	public update(time: number, delta: number): void {
		// Smooth scale animation
		if (Math.abs(this.currentScale - this.targetScale) > 0.01) {
			this.currentScale = Phaser.Math.Linear(
				this.currentScale,
				this.targetScale,
				0.1,
			);
			this.setScale(this.currentScale);
		}

		// Add subtle idle animation around committed center
		if (!this.isDragging && !this.isHovered) {
			const idleOffset = Math.sin(time * 0.002) * 0.5;
			this.y = this.committedCenterY + idleOffset;
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
				const mouseRelativeX = Phaser.Math.Clamp(
					(pointer.x - this.x) * 2,
					-value,
					value,
				);
				const mouseRelativeY = Phaser.Math.Clamp(
					(pointer.y - this.y) * 2,
					-value,
					value,
				);
				this.shaderUniforms.mouseScreenPos = [mouseRelativeX, mouseRelativeY];
			} else {
				this.shaderUniforms.mouseScreenPos = [0.0, 0.0];
			}

			try {
				this.hoverShader.set1f("hovering", this.shaderUniforms.hovering);
				this.hoverShader.set2f(
					"mouseScreenPos",
					this.shaderUniforms.mouseScreenPos[0],
					this.shaderUniforms.mouseScreenPos[1],
				);
				this.hoverShader.set1f("time", this.shaderUniforms.time);
				this.hoverShader.set2f(
					"cardSize",
					this.shaderUniforms.objectSize[0],
					this.shaderUniforms.objectSize[1],
				);
				this.hoverShader.set1f(
					"flipProgress",
					this.shaderUniforms.flipProgress,
				);
			} catch (_e) {
				// Shader might not be ready or WebGL unavailable – fail silently
			}
		}
	}

	// Removed legacy grid APIs; UI is now fully decoupled from state

	destroy(fromScene?: boolean): void {
		if (this.shadowTween) {
			this.shadowTween.stop();
		}
		super.destroy(fromScene);
	}
}
