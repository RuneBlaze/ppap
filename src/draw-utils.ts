// Icon spritesheet is now loaded by BootScene
import { ColorUtils } from "./color-utils";
import { type FontKey, fonts, getFontStyle } from "./fonts";
import { Palette } from "./palette";

export interface WindowSkinOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	borderColor?: string;
	fillColor?: string;
	cornerRadius?: number;
}

export interface GaugeOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	value: number;
	maxValue: number;
	borderColor?: string;
	backgroundFillColor?: string;
	gradientStart?: string;
	gradientEnd?: string;
	fontKey?: FontKey;
	showValue?: boolean;
	showMaxValue?: boolean;
	quantize?: boolean;
}

export interface DitherOptions {
	intensity?: number;
	paletteColors?: string[];
}

// Stylized dithering shader with GPU-friendly approximation
class StylizedDitherShader extends Phaser.Renderer.WebGL.Pipelines
	.PostFXPipeline {
	private _intensity: number = 1.0;
	private _resolution: { width: number; height: number } = {
		width: 800,
		height: 600,
	};

	constructor(game: Phaser.Game) {
		super({
			game,
			name: "StylizedDither",
			renderTarget: true,
			fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float     intensity;        // 0 → off, 1 → full dither
uniform vec2      resolution;       // framebuffer size in pixels
uniform vec3      paletteColors[32];

varying vec2 outTexCoord;

/* -------- sRGB → OKLab conversion utilities ---------------------------- */
vec3 srgbToLinear(vec3 c)
{
    vec3 cutoff = vec3(0.04045);
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(cutoff, c));
}

vec3 rgbToOklab(vec3 c)
{
    vec3 lrgb = srgbToLinear(c);

    // linear RGB → LMS
    float l = 0.4122214708 * lrgb.r + 0.5363325363 * lrgb.g + 0.0514459929 * lrgb.b;
    float m = 0.2119034982 * lrgb.r + 0.6806995451 * lrgb.g + 0.1073969566 * lrgb.b;
    float s = 0.0883024619 * lrgb.r + 0.2817188376 * lrgb.g + 0.6299787005 * lrgb.b;

    // cube-root and final OKLab transform
    vec3 lms = vec3(pow(l, 1.0/3.0), pow(m, 1.0/3.0), pow(s, 1.0/3.0));

    return vec3(
        0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
        1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
        0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z
    );
}

/* -------- nearest-colour quantiser in OKLab space ----------------------- */
vec3 quantizeToNearestPalette(vec3 c)
{
    vec3 labC = rgbToOklab(c);
    float bestDist = 999.0;
    vec3  bestCol  = paletteColors[0];

    for (int i = 0; i < 32; ++i)
    {
        vec3 labP = rgbToOklab(paletteColors[i]);
        float d = length(labC - labP);
        if (d < bestDist) { bestDist = d; bestCol = paletteColors[i]; }
    }
    return bestCol;
}

/* -------- blue-noise threshold function --------------------------------- */
/* Generates a pseudo–blue-noise value in the range 0-1 based on pixel
   position using a simple hash function (adapted from Inigo Quilez).
   While not a true pre-computed blue-noise pattern, it concentrates most
   energy in high frequencies, avoiding the obvious grid patterns of Bayer
   matrices and producing a visually pleasing stochastic dither.          */
float blueNoise(vec2 pixPos)
{
    // Integer pixel coordinates ‑ reduces correlation between neighbours
    vec2 ip = floor(pixPos);
    // Hash → fract(sin(dot(..)))*const
    return fract( sin( dot(ip ,vec2(127.1, 311.7)) ) * 43758.5453 );
}

void main()
{
    vec2 pixPos = outTexCoord * resolution;
    vec4 src    = texture2D(uMainSampler, outTexCoord);

    if (src.a < 0.1) {                      // keep near-transparent texels
        gl_FragColor = src;
        return;
    }

    /* --- blue-noise dither bias ------------------------------------------ */
    float t = blueNoise(pixPos);            // 0-1 threshold
    const float scale = 1.0 / 255.0;        // ±1 step in 8-bit space
    vec3  nudged = src.rgb + (t - 0.5) * (2.0 * scale * intensity);

    /* --- quantise & blend ------------------------------------------------- */
    vec3 quantised = quantizeToNearestPalette(clamp(nudged, 0.0, 1.0));
    gl_FragColor   = vec4(mix(src.rgb, quantised, intensity), src.a);
}
`,
		});
	}

	onPreRender(): void {
		this.set1f("intensity", this._intensity);
		this.set2f("resolution", this._resolution.width, this._resolution.height);

		// Set palette colors
		const paletteColors = DrawUtils.getPaletteColorsForShader();
		this.set3fv("paletteColors", new Float32Array(paletteColors));
	}

	get intensity(): number {
		return this._intensity;
	}

	set intensity(value: number) {
		this._intensity = value;
	}

	get resolution(): { width: number; height: number } {
		return this._resolution;
	}

	set resolution(value: { width: number; height: number }) {
		this._resolution = value;
	}
}

export class DrawUtils {
	static readonly ICONS_KEY = "icons";
	static readonly ICON_SIZE = 16;

	// Draw retro JRPG windowskin with rounded corners
	static drawWindowSkin(
		graphics: Phaser.GameObjects.Graphics,
		options: WindowSkinOptions,
	): void {
		const {
			x,
			y,
			width,
			height,
			borderColor = Palette.WHITE.hex,
			fillColor = Palette.DARK_PURPLE.hex,
			cornerRadius = 2,
		} = options;

		graphics.clear();

		// Fill background
		graphics.fillStyle(Phaser.Display.Color.HexStringToColor(fillColor).color);
		graphics.fillRoundedRect(x, y, width, height, cornerRadius);

		// Draw border - single pixel width
		graphics.lineStyle(
			1,
			Phaser.Display.Color.HexStringToColor(borderColor).color,
		);
		graphics.strokeRoundedRect(x, y, width, height, cornerRadius);
	}

	// Create gradient colors with optional quantization
	static createGradientColors(
		startColor: string,
		endColor: string,
		steps: number,
		quantize: boolean = true,
	): string[] {
		const colors: string[] = [];

		for (let i = 0; i < steps; i++) {
			const t = i / (steps - 1);
			const interpolated = ColorUtils.interpolateOklab(startColor, endColor, t);
			const finalColor = quantize
				? ColorUtils.quantizeToPalette(interpolated)
				: `#${interpolated.r.toString(16).padStart(2, "0")}${interpolated.g.toString(16).padStart(2, "0")}${interpolated.b.toString(16).padStart(2, "0")}`;
			colors.push(finalColor);
		}

		return colors;
	}

	// Draw gauge with gradient and numbers
	static drawGauge(
		scene: Phaser.Scene,
		graphics: Phaser.GameObjects.Graphics,
		options: GaugeOptions,
	): Phaser.GameObjects.Text | null {
		const {
			x,
			y,
			width,
			height,
			value,
			maxValue,
			borderColor = Palette.WHITE.hex,
			backgroundFillColor = Palette.DARK_PURPLE.hex,
			gradientStart = Palette.RED.hex,
			gradientEnd = Palette.GREEN.hex,
			fontKey = "retro",
			showValue = true,
			showMaxValue = false,
			quantize = true,
		} = options;

		const fillPercentage = Math.max(0, Math.min(1, value / maxValue));
		const fillWidth = Math.floor((width - 2) * fillPercentage);

		graphics.clear();

		// Background fill
		graphics.fillStyle(
			Phaser.Display.Color.HexStringToColor(backgroundFillColor).color,
		);
		graphics.fillRect(x, y, width, height);

		// Create gradient for gauge fill
		if (fillWidth > 0) {
			const gradientSteps = Math.max(1, fillWidth);
			const gradientColors = DrawUtils.createGradientColors(
				gradientStart,
				gradientEnd,
				gradientSteps,
				quantize,
			);

			// Draw gradient fill pixel by pixel for retro look
			for (let i = 0; i < fillWidth; i++) {
				const colorIndex = Math.floor(
					(i / fillWidth) * (gradientColors.length - 1),
				);
				const color = gradientColors[colorIndex];
				graphics.fillStyle(Phaser.Display.Color.HexStringToColor(color).color);
				graphics.fillRect(x + 1 + i, y + 1, 1, height - 2);
			}
		}

		// Border
		graphics.lineStyle(
			1,
			Phaser.Display.Color.HexStringToColor(borderColor).color,
		);
		graphics.strokeRect(x, y, width, height);

		// Add text if requested
		if (showValue || showMaxValue) {
			const textContent = showMaxValue ? `${value}/${maxValue}` : `${value}`;
			const textStyle = getFontStyle(fontKey);
			const fontConfig = fonts[fontKey];

			const text = scene.add.text(
				x + width + 4,
				y + (height - fontConfig.size) / 2,
				textContent,
				textStyle,
			);

			return text;
		}

		return null;
	}

	/**
	 * Draws an icon from the icon sheet at the specified position.
	 * Assumes assets have been loaded in BootScene.
	 * @param scene - The Phaser scene
	 * @param x - X position
	 * @param y - Y position
	 * @param iconIndex - Index of the icon in the spritesheet
	 * @returns A new `Phaser.GameObjects.Image` instance for the icon.
	 */
	static drawIcon(
		scene: Phaser.Scene,
		x: number,
		y: number,
		iconIndex: number,
	): Phaser.GameObjects.Image {
		const icon = scene.add.image(x, y, DrawUtils.ICONS_KEY, iconIndex);
		return icon;
	}

	// Helper to create windowskin as a reusable texture
	static createWindowSkinTexture(
		scene: Phaser.Scene,
		key: string,
		options: WindowSkinOptions,
	): void {
		const { width, height } = options;
		const rt = scene.add.renderTexture(0, 0, width, height);
		const graphics = scene.add.graphics();

		DrawUtils.drawWindowSkin(graphics, { ...options, x: 0, y: 0 });
		rt.draw(graphics);
		rt.saveTexture(key);

		graphics.destroy();
		rt.destroy();
	}

	// Convert hex color to normalized RGB values for shaders
	static hexToVec3(hex: string): [number, number, number] {
		// Remove the # if present
		const cleanHex = hex.replace("#", "");

		// Parse RGB components
		const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
		const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
		const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

		return [r, g, b];
	}

	// Get all palette colors as vec3 array for shader uniforms
	static getPaletteColorsForShader(): number[] {
		const paletteVec3: number[] = [];
		const paletteColors = [
			Palette.BLACK.hex,
			Palette.DARK_PURPLE.hex,
			Palette.DARK_BURGUNDY.hex,
			Palette.BROWN.hex,
			Palette.RUST.hex,
			Palette.ORANGE.hex,
			Palette.SAND.hex,
			Palette.BEIGE.hex,
			Palette.YELLOW.hex,
			Palette.LIME.hex,
			Palette.GREEN.hex,
			Palette.DARK_GREEN.hex,
			Palette.OLIVE.hex,
			Palette.DARK_OLIVE.hex,
			Palette.DARK_TEAL.hex,
			Palette.INDIGO.hex,
			Palette.BLUE.hex,
			Palette.BRIGHT_BLUE.hex,
			Palette.SKY_BLUE.hex,
			Palette.CYAN.hex,
			Palette.LIGHT_BLUE.hex,
			Palette.WHITE.hex,
			Palette.GRAY.hex,
			Palette.DARK_GRAY.hex,
			Palette.CHARCOAL.hex,
			Palette.DARK_CHARCOAL.hex,
			Palette.PURPLE.hex,
			Palette.RED.hex,
			Palette.PINK.hex,
			Palette.MAGENTA.hex,
			Palette.YELLOW_GREEN.hex,
			Palette.GOLD.hex,
		];

		paletteColors.forEach((hex) => {
			const [r, g, b] = DrawUtils.hexToVec3(hex);
			paletteVec3.push(r, g, b);
		});

		return paletteVec3;
	}

	// Register stylized dithering shader with the renderer
	static registerStylizedDitherShader(game: Phaser.Game): void {
		const renderer = game.renderer;

		if (renderer.type === Phaser.WEBGL) {
			const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;

			try {
				// Register shader using the pipeline manager's class registration method
				webglRenderer.pipelines.addPostPipeline(
					"StylizedDither",
					StylizedDitherShader,
				);

				console.log("Stylized dithering shader registered successfully");
			} catch (error) {
				console.error("Failed to register stylized dithering shader:", error);
			}
		} else {
			console.warn(
				"WebGL renderer not available for stylized dithering shader",
			);
		}
	}

	// Apply stylized dithering to a sprite or image
	static applyStylizedDither(
		gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
		options: DitherOptions = {},
	): boolean {
		const { intensity = 1.0 } = options;
		const renderer = gameObject.scene.game.renderer;

		if (renderer.type !== Phaser.WEBGL) {
			console.warn("Stylized dithering shader requires WebGL renderer");
			return false;
		}

		try {
			// Apply the post-pipeline to the game object
			gameObject.setPostPipeline("StylizedDither");

			// Get the shader instance and set properties
			const shader = gameObject.getPostPipeline(
				"StylizedDither",
			) as StylizedDitherShader;
			if (!shader) {
				console.warn(
					"StylizedDither shader not registered. Call registerStylizedDitherShader() first.",
				);
				return false;
			}

			// Set shader properties - uniforms will be set in onPreRender
			shader.intensity = intensity;
			shader.resolution = {
				width: gameObject.width,
				height: gameObject.height,
			};

			return true;
		} catch (error) {
			console.error("Failed to apply stylized dithering:", error);
			return false;
		}
	}

	// Remove stylized dithering from a game object
	static removeStylizedDithering(
		gameObject: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
	): void {
		gameObject.resetPipeline();
	}

	// Apply stylized dithering to all sprites in a container or group
	static applyStylizedDitherToGroup(
		group: Phaser.GameObjects.Container | Phaser.GameObjects.Group,
		options: DitherOptions = {},
	): void {
		if (group instanceof Phaser.GameObjects.Container) {
			group.each((child: Phaser.GameObjects.GameObject) => {
				if (
					child instanceof Phaser.GameObjects.Image ||
					child instanceof Phaser.GameObjects.Sprite
				) {
					DrawUtils.applyStylizedDither(child, options);
				}
			});
		} else if (group instanceof Phaser.GameObjects.Group) {
			group.children.entries.forEach((child: Phaser.GameObjects.GameObject) => {
				if (
					child instanceof Phaser.GameObjects.Image ||
					child instanceof Phaser.GameObjects.Sprite
				) {
					DrawUtils.applyStylizedDither(child, options);
				}
			});
		}
	}
}
