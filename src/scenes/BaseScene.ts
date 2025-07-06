import Phaser from "phaser";
import cursorImg from "../assets/cursor.png";
import particleSheet from "../assets/spritesheet_transparent.png";
import { DrawUtils } from "../draw-utils";
import { loadFonts } from "../fonts";
import { Palette } from "../palette";
import { Anim, type EmitterConfig } from "../base/ps";
import animPredefs from "../assets/anims.toml";

export abstract class BaseScene extends Phaser.Scene {
	private cursorSprite?: Phaser.GameObjects.Image;
	private activeAnims: Anim[] = [];

	// Dithering toggle state
	private ditheringEnabled: boolean = true;

	constructor(key: string) {
		super(key);
	}

	preload() {
		if (!this.textures.exists("cursor")) {
			this.load.image("cursor", cursorImg);
		}
		// Load 8x8 sprite sheet used by the custom particle system
		if (!this.textures.exists("ps_particle")) {
			this.load.spritesheet("ps_particle", particleSheet, {
				frameWidth: 8,
				frameHeight: 8,
			});
		}
		DrawUtils.preloadAssets(this);
		this.preloadSceneAssets();
	}

	async create() {
		this.cameras.main.setBackgroundColor(Palette.BLACK.hex);

		this.setupCursor();

		await loadFonts();

		// Apply Floyd-Steinberg dithering to the entire scene
		this.setupSceneDithering();

		// Setup dithering toggle key
		this.setupDitheringToggle();

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

		this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
			if (this.cursorSprite) {
				const camera = this.cameras.main;
				this.cursorSprite.x = camera.scrollX + pointer.x / camera.zoom;
				this.cursorSprite.y = camera.scrollY + pointer.y / camera.zoom;
			}
		});
	}

	private setupSceneDithering() {
		// Register dithering shaders with the game
		DrawUtils.registerStylizedDitherShader(this.game);

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

	private setupDitheringToggle() {
		// Add keyboard listener for 'D' key to toggle dithering
		this.input.keyboard?.on("keydown-D", () => {
			this.toggleDithering();
		});
	}

	private toggleDithering() {
		this.ditheringEnabled = !this.ditheringEnabled;

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
	}

	addPredefinedAnim(key: string, x: number, y: number, playSpeed = 1): Anim | undefined {
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
