import Phaser from "phaser";
import animPredefs from "../assets/data/anims.toml";
import { Anim, type EmitterConfig } from "../base/ps";
import { Palette } from "../palette";
import { FocusManager } from "../ui/state/FocusManager";

export abstract class BaseScene extends Phaser.Scene {
	private cursorSprite?: Phaser.GameObjects.Image;
	private activeAnims: Anim[] = [];
	protected focusManager!: FocusManager;

	// Dithering toggle state
	private ditheringEnabled: boolean = true;

	preload() {
		this.preloadSceneAssets();
	}

	async create() {
		this.cameras.main.setBackgroundColor(Palette.BLACK.hex);

		this.focusManager = new FocusManager(this);
		this.setupCursor();

		// Apply Floyd-Steinberg dithering to the entire scene
		this.setupSceneDithering();

		// Setup debug event listeners
		this.setupDebugEvents();

		this.createScene();
	}

	private setupCursor(): void {
		this.input.setDefaultCursor("none");
		this.createCursorSprite();
	}

	private createCursorSprite(): void {
		this.cursorSprite = this.add.image(0, 0, "cursor");
		this.cursorSprite.setOrigin(0, 0);
		this.cursorSprite.setDepth(10000);
		this.cursorSprite.setScrollFactor(0);

		this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
			if (this.cursorSprite) {
				// Position cursor directly based on pointer position
				this.cursorSprite.x = pointer.x / this.cameras.main.zoom;
				this.cursorSprite.y = pointer.y / this.cameras.main.zoom;
			}
		});
	}

	private setupSceneDithering() {
		// Apply Floyd-Steinberg dithering to the main camera (entire scene)
		const mainCamera = this.cameras.main;

		try {
			// Apply the post-pipeline to the camera
			mainCamera.setPostPipeline("StylizedDither");

			// Get the shader instance and configure it
			const shader = mainCamera.getPostPipeline("StylizedDither") as any;
			if (shader) {
				// Set intensity to 1.0 for default dithering effect
				shader.intensity = 1.0;
				shader.resolution = {
					width: mainCamera.width,
					height: mainCamera.height,
				};

				console.log("Stylized dithering applied to entire scene");
			} else {
				console.warn("StylizedDither shader not found after registration");
			}
		} catch (error) {
			console.error("Failed to apply scene dithering:", error);
		}
	}

	private setupDebugEvents() {
		// Listen for debug events from the HTML UI
		this.events.on("debug:toggleDithering", () => {
			this.toggleDithering();
		});
	}

	private toggleDithering() {
		// Get the desired state from the UI
		const desiredState =
			typeof window !== "undefined" && window.debugStore
				? window.debugStore.dithering
				: !this.ditheringEnabled;

		this.ditheringEnabled = desiredState;
		console.log("Scene dithering set to:", this.ditheringEnabled);

		const mainCamera = this.cameras.main;

		if (this.ditheringEnabled) {
			// Re-enable dithering
			try {
				mainCamera.setPostPipeline("StylizedDither");
				const shader = mainCamera.getPostPipeline("StylizedDither") as any;
				if (shader) {
					shader.intensity = 1.0;
					shader.resolution = {
						width: mainCamera.width,
						height: mainCamera.height,
					};
				}
				console.log("Dithering enabled");
			} catch (error) {
				console.error("Failed to enable dithering:", error);
			}
		} else {
			// Disable dithering
			try {
				mainCamera.resetPostPipeline();
				console.log("Dithering disabled");
			} catch (error) {
				console.error("Failed to disable dithering:", error);
			}
		}

		// Don't update the HTML UI state here - let Alpine.js handle it to avoid double-toggle
	}

	addPredefinedAnim(
		key: string,
		x: number,
		y: number,
		playSpeed = 1,
	): Anim | undefined {
		const animConfigs = (animPredefs.anims as Record<string, EmitterConfig[]>)[
			key
		];
		if (!animConfigs) {
			console.warn(`Animation with key "${key}" not found in animPredefs.`);
			return undefined;
		}

		const newAnim = new Anim(x, y, animConfigs, playSpeed);
		this.activeAnims.push(newAnim);
		return newAnim;
	}

	protected abstract preloadSceneAssets(): void;
	protected abstract createScene(): void;

	// Flush particle system draw calls every frame.
	update(_time: number, delta: number): void {
		// Update animations
		this.activeAnims = this.activeAnims.filter((anim) => {
			if (anim.dead) {
				return false;
			}
			anim.update(delta / 1000); // ps.ts update expects seconds
			return true;
		});

		// Draw any queued particle system graphics.
		Anim.flushDrawCalls(this);
	}
}
