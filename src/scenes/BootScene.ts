import Phaser from "phaser";
import {
	ImageKeys,
	Images,
	OtherAssets,
	OtherKeys,
	SpritesheetKeys,
	Spritesheets,
} from "@/assets/AssetManifest";
import { DrawUtils } from "@/draw-utils";
import { loadFonts } from "@/fonts";
import { Palette } from "@/palette";
import { NoisePatternShader } from "@/shaders/NoisePatternShader";

interface LoadingProgress {
	totalAssets: number;
	loadedAssets: number;
	currentAsset: string;
	phase:
		| "images"
		| "spritesheets"
		| "fonts"
		| "shaders"
		| "textures"
		| "validation"
		| "complete";
	phaseProgress: number;
	totalProgress: number;
}

export class BootScene extends Phaser.Scene {
	private loadingProgress: LoadingProgress;
	private loadingText!: Phaser.GameObjects.Text;
	private progressBar!: Phaser.GameObjects.Graphics;
	private progressBarBg!: Phaser.GameObjects.Graphics;
	private detailText!: Phaser.GameObjects.Text;
	private assetsValidated = false;
	private isReady = false;

	constructor() {
		super({ key: "BootScene" });
		this.loadingProgress = {
			totalAssets: 0,
			loadedAssets: 0,
			currentAsset: "",
			phase: "images",
			phaseProgress: 0,
			totalProgress: 0,
		};
	}

	preload() {
		// Calculate total assets for progress tracking
		this.calculateTotalAssets();

		// Create loading UI immediately
		this.createLoadingDisplay();

		// Set up loading event handlers
		this.setupLoadingHandlers();

		// Start loading assets
		this.loadImageAssets();
		this.loadSpritesheetAssets();

		// Block any other scenes from starting
		this.blockSceneTransitions();
	}

	async create() {
		// CRITICAL: Do not proceed until ALL assets are loaded and validated
		if (!this.load.isReady()) {
			console.error("BootScene.create() called but assets are not ready!");
			return;
		}

		try {
			// Phase 1: Load fonts
			this.updateLoadingProgress("fonts", 0, "Loading fonts...");
			await this.loadFontsPhase();

			// Phase 2: Register shaders
			this.updateLoadingProgress("shaders", 0, "Registering shaders...");
			await this.registerShadersPhase();

			// Phase 3: Generate dynamic textures
			this.updateLoadingProgress(
				"textures",
				0,
				"Generating dynamic textures...",
			);
			await this.generateDynamicTexturesPhase();

			// Phase 4: Validate all assets
			this.updateLoadingProgress("validation", 0, "Validating assets...");
			await this.validateAllAssets();

			// Phase 5: Complete
			this.updateLoadingProgress("complete", 100, "Ready!");

			// Mark as ready and allow scene transitions
			this.isReady = true;
			this.unblockSceneTransitions();

			// Small delay to show "Ready!" message
			this.time.delayedCall(500, () => {
				// Get the target scene from registry (set by routing)
				const targetScene = this.registry.get("targetScene") || "BattleScene";
				console.log(
					`Assets loaded successfully, transitioning to: ${targetScene}`,
				);
				this.scene.start(targetScene);
			});
		} catch (error) {
			console.error("Critical error during asset loading:", error);
			this.showLoadingError(
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	private calculateTotalAssets() {
		// Count images (excluding dynamic ones)
		const imageCount = Object.values(Images).filter((path) => path).length;

		// Count spritesheets
		const spritesheetCount = Object.keys(Spritesheets).length;

		// Count other assets (fonts, etc.)
		const fontCount = 7; // From fonts.ts
		const shaderCount = 2; // Dither + Noise Pattern
		const dynamicTextureCount = 1; // Background texture

		this.loadingProgress.totalAssets =
			imageCount +
			spritesheetCount +
			fontCount +
			shaderCount +
			dynamicTextureCount;
	}

	private createLoadingDisplay() {
		const centerX = this.cameras.main.centerX;
		const centerY = this.cameras.main.centerY;

		// Main loading text
		this.loadingText = this.add.text(
			centerX,
			centerY - 40,
			"Loading Assets...",
			{
				fontSize: "16px",
				color: Palette.WHITE.hex,
				fontFamily: "monospace",
			},
		);
		this.loadingText.setOrigin(0.5);

		// Progress bar background
		this.progressBarBg = this.add.graphics();
		this.progressBarBg.fillStyle(Palette.DARK_GRAY.num);
		this.progressBarBg.fillRect(centerX - 100, centerY - 10, 200, 20);

		// Progress bar
		this.progressBar = this.add.graphics();

		// Detail text
		this.detailText = this.add.text(centerX, centerY + 20, "", {
			fontSize: "12px",
			color: Palette.GRAY.hex,
			fontFamily: "monospace",
		});
		this.detailText.setOrigin(0.5);

		// Phase indicator
		const phaseText = this.add.text(
			centerX,
			centerY + 40,
			"Phase: Loading Images",
			{
				fontSize: "10px",
				color: Palette.DARK_GRAY.hex,
				fontFamily: "monospace",
			},
		);
		phaseText.setOrigin(0.5);
	}

	private setupLoadingHandlers() {
		// Track individual file loading
		this.load.on("load", (file: Phaser.Loader.File) => {
			this.loadingProgress.loadedAssets++;
			this.loadingProgress.currentAsset = file.key;
			this.updateProgressDisplay();
		});

		// Handle loading errors
		this.load.on("loaderror", (file: Phaser.Loader.File) => {
			console.error(`Failed to load asset: ${file.key} (${file.src})`);
			this.showLoadingError(new Error(`Failed to load: ${file.key}`));
		});

		// Handle loading completion
		this.load.on("complete", () => {
			console.log("All Phaser assets loaded successfully");
		});
	}

	private loadImageAssets() {
		this.updateLoadingProgress("images", 0, "Loading images...");

		Object.entries(Images).forEach(([key, path]) => {
			if (path) {
				this.load.image(key, path);
			}
		});
	}

	private loadSpritesheetAssets() {
		Object.entries(Spritesheets).forEach(([key, config]) => {
			this.load.spritesheet(key, config.path, {
				frameWidth: config.frameWidth,
				frameHeight: config.frameHeight,
			});
		});
	}

	private async loadFontsPhase(): Promise<void> {
		return new Promise((resolve, reject) => {
			loadFonts()
				.then(() => {
					this.updateLoadingProgress("fonts", 100, "Fonts loaded");
					resolve();
				})
				.catch(reject);
		});
	}

	private async registerShadersPhase(): Promise<void> {
		return new Promise((resolve) => {
			try {
				// Register Stylized Dither Shader
				DrawUtils.registerStylizedDitherShader(this.game);
				this.updateLoadingProgress("shaders", 50, "Dither shader registered");

				// Register Noise Pattern Shader
				NoisePatternShader.registerShader(this.game);
				this.updateLoadingProgress("shaders", 100, "All shaders registered");

				resolve();
			} catch (error) {
				console.error("Failed to register shaders:", error);
				resolve(); // Don't fail the entire loading process
			}
		});
	}

	private async generateDynamicTexturesPhase(): Promise<void> {
		return new Promise((resolve) => {
			// Generate background texture (from BattleScene logic)
			const backgroundTexture = this.add.renderTexture(0, 0, 427, 240);

			// Create noise pattern background
			const graphics = this.add.graphics();
			graphics.fillStyle(Palette.BLACK.num);
			graphics.fillRect(0, 0, 427, 240);

			// Add some texture/noise
			for (let i = 0; i < 1000; i++) {
				const x = Phaser.Math.Between(0, 427);
				const y = Phaser.Math.Between(0, 240);
				const alpha = Phaser.Math.FloatBetween(0.1, 0.3);

				graphics.fillStyle(Palette.WHITE.num, alpha);
				graphics.fillRect(x, y, 1, 1);
			}

			backgroundTexture.draw(graphics);
			backgroundTexture.saveTexture(ImageKeys.BACKGROUND_TEXTURE);

			// Clean up temporary objects
			graphics.destroy();
			backgroundTexture.destroy();

			this.updateLoadingProgress("textures", 100, "Dynamic textures generated");
			resolve();
		});
	}

	private async validateAllAssets(): Promise<void> {
		return new Promise((resolve, reject) => {
			const missingAssets: string[] = [];

			// Validate images
			Object.keys(Images).forEach((key) => {
				if (!this.textures.exists(key)) {
					missingAssets.push(`Image: ${key}`);
				}
			});

			// Validate spritesheets
			Object.keys(Spritesheets).forEach((key) => {
				if (!this.textures.exists(key)) {
					missingAssets.push(`Spritesheet: ${key}`);
				}
			});

			// CRITICAL: Validate particle system spritesheet specifically
			if (!this.textures.exists(SpritesheetKeys.PS_PARTICLE)) {
				missingAssets.push(
					`CRITICAL - Particle System Spritesheet: ${SpritesheetKeys.PS_PARTICLE}`,
				);
			} else {
				// Validate that the spritesheet has frames
				const texture = this.textures.get(SpritesheetKeys.PS_PARTICLE);
				if (
					!texture ||
					!texture.frames ||
					Object.keys(texture.frames).length <= 1
				) {
					missingAssets.push(
						`Particle System Spritesheet has no frames: ${SpritesheetKeys.PS_PARTICLE}`,
					);
				} else {
					console.log(
						`Particle system spritesheet validated: ${SpritesheetKeys.PS_PARTICLE} with ${Object.keys(texture.frames).length - 1} frames`,
					);
				}
			}

			// Validate dynamic textures
			if (!this.textures.exists(ImageKeys.BACKGROUND_TEXTURE)) {
				missingAssets.push(`Dynamic texture: ${ImageKeys.BACKGROUND_TEXTURE}`);
			}

			if (missingAssets.length > 0) {
				const error = new Error(`Missing assets: ${missingAssets.join(", ")}`);
				reject(error);
				return;
			}

			this.assetsValidated = true;
			this.updateLoadingProgress("validation", 100, "All assets validated");
			resolve();
		});
	}

	private updateLoadingProgress(
		phase: LoadingProgress["phase"],
		phaseProgress: number,
		currentAsset: string,
	) {
		this.loadingProgress.phase = phase;
		this.loadingProgress.phaseProgress = phaseProgress;
		this.loadingProgress.currentAsset = currentAsset;

		// Calculate total progress based on phase
		const phaseWeights = {
			images: 0.4,
			spritesheets: 0.2,
			fonts: 0.15,
			shaders: 0.1,
			textures: 0.1,
			validation: 0.04,
			complete: 0.01,
		};

		let totalProgress = 0;
		const phases = Object.keys(phaseWeights) as (keyof typeof phaseWeights)[];
		const currentPhaseIndex = phases.indexOf(phase);

		// Add completed phases
		for (let i = 0; i < currentPhaseIndex; i++) {
			totalProgress += phaseWeights[phases[i]] * 100;
		}

		// Add current phase progress
		totalProgress += phaseWeights[phase] * phaseProgress;

		this.loadingProgress.totalProgress = Math.min(100, totalProgress);
		this.updateProgressDisplay();
	}

	private updateProgressDisplay() {
		const progress = this.loadingProgress.totalProgress;
		const centerX = this.cameras.main.centerX;
		const centerY = this.cameras.main.centerY;

		// Update progress bar
		this.progressBar.clear();
		this.progressBar.fillStyle(Palette.GREEN.num);
		this.progressBar.fillRect(
			centerX - 100,
			centerY - 10,
			(200 * progress) / 100,
			20,
		);

		// Update text
		this.loadingText.setText(`Loading Assets... ${Math.round(progress)}%`);
		this.detailText.setText(`${this.loadingProgress.currentAsset}`);
	}

	private showLoadingError(error: Error) {
		this.loadingText.setText("LOADING ERROR!");
		this.loadingText.setColor(Palette.RED.hex);
		this.detailText.setText(error.message);
		this.detailText.setColor(Palette.RED.hex);

		// Add retry button
		const retryText = this.add.text(
			this.cameras.main.centerX,
			this.cameras.main.centerY + 60,
			"Click to retry",
			{
				fontSize: "12px",
				color: Palette.YELLOW.hex,
				fontFamily: "monospace",
			},
		);
		retryText.setOrigin(0.5);
		retryText.setInteractive();
		retryText.on("pointerdown", () => {
			this.scene.restart();
		});
	}

	private blockSceneTransitions() {
		// Override scene manager to prevent transitions
		const originalStart = this.scene.start;
		this.scene.start = (key: string) => {
			if (!this.isReady && key !== "BootScene") {
				console.warn(`Scene transition to ${key} blocked - assets not ready`);
				return this.scene;
			}
			return originalStart.call(this.scene, key);
		};
	}

	private unblockSceneTransitions() {
		// Restore normal scene transitions
		// This is handled by the scene manager automatically
		console.log("Scene transitions unblocked - all assets ready");
	}
}
