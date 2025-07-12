import Phaser from "phaser";
import {
	ImageKeys,
	Images,
	OtherAssets,
	OtherKeys,
	Spritesheets,
} from "@/assets/AssetManifest";
import { DrawUtils } from "@/draw-utils";
import { loadFonts } from "@/fonts";
import { Palette } from "@/palette";
import { NoisePatternShader } from "@/shaders/NoisePatternShader";

export class BootScene extends Phaser.Scene {
	constructor() {
		super({ key: "BootScene" });
	}

	preload() {
		// Load all images from manifest
		Object.entries(Images).forEach(([key, path]) => {
			if (path) {
				// Skip background texture which is generated dynamically
				this.load.image(key, path);
			}
		});

		// Load all spritesheets from manifest
		Object.entries(Spritesheets).forEach(([key, config]) => {
			this.load.spritesheet(key, config.path, {
				frameWidth: config.frameWidth,
				frameHeight: config.frameHeight,
			});
		});

		// Load other assets
		Object.entries(OtherAssets).forEach(([key, _path]) => {
			// Handle different asset types as needed
			if (key === OtherKeys.ANIMS_TOML) {
				// TOML files are handled by the import system, not Phaser loader
			}
		});

		// Create loading progress display (optional)
		this.createLoadingDisplay();
	}

	async create() {
		// Load fonts
		await loadFonts();

		// Register all shaders
		this.registerShaders();

		// Generate dynamic textures
		this.generateDynamicTextures();

		// Start the default scene (BattleScene as per current main.ts)
		this.scene.start("BattleScene");
	}

	private createLoadingDisplay() {
		// Simple loading text
		const loadingText = this.add.text(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			"Loading...",
			{
				fontSize: "16px",
				color: "#ffffff",
			},
		);
		loadingText.setOrigin(0.5);

		// Update progress
		this.load.on("progress", (value: number) => {
			loadingText.setText(`Loading... ${Math.round(value * 100)}%`);
		});

		this.load.on("complete", () => {
			loadingText.destroy();
		});
	}

	private registerShaders() {
		try {
			// Register Stylized Dither Shader
			DrawUtils.registerStylizedDitherShader(this.game);
			console.log("Stylized Dither shader registered");
		} catch (error) {
			console.error("Failed to register Stylized Dither shader:", error);
		}

		try {
			// Register Noise Pattern Shader
			NoisePatternShader.registerShader(this.game);
			console.log("Noise Pattern shader registered");
		} catch (error) {
			console.error("Failed to register Noise Pattern shader:", error);
		}
	}

	private generateDynamicTextures() {
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
	}
}
