import { Palette } from "./palette";

// OKlab color space utilities
interface OKLab {
	L: number;
	a: number;
	b: number;
}

interface RGB {
	r: number;
	g: number;
	b: number;
}

export class ColorUtils {
	// Convert hex to RGB
	static hexToRgb(hex: string): RGB {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return { r, g, b };
	}

	// Convert RGB to OKlab
	static rgbToOklab(rgb: RGB): OKLab {
		// Normalize RGB to 0-1 range
		const r = rgb.r / 255;
		const g = rgb.g / 255;
		const b = rgb.b / 255;

		// Linear RGB transformation
		const lr = r < 0.04045 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4;
		const lg = g < 0.04045 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4;
		const lb = b < 0.04045 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4;

		// Linear RGB to OKlab
		const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
		const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
		const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

		const l_ = Math.cbrt(l);
		const m_ = Math.cbrt(m);
		const s_ = Math.cbrt(s);

		return {
			L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
			a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
			b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
		};
	}

	// Convert OKlab to RGB
	static oklabToRgb(oklab: OKLab): RGB {
		const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
		const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
		const s_ = oklab.L - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

		const l = l_ * l_ * l_;
		const m = m_ * m_ * m_;
		const s = s_ * s_ * s_;

		const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
		const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
		const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

		// Linear RGB to sRGB
		const r = lr > 0.0031308 ? 1.055 * lr ** (1 / 2.4) - 0.055 : 12.92 * lr;
		const g = lg > 0.0031308 ? 1.055 * lg ** (1 / 2.4) - 0.055 : 12.92 * lg;
		const b = lb > 0.0031308 ? 1.055 * lb ** (1 / 2.4) - 0.055 : 12.92 * lb;

		return {
			r: Math.round(Math.max(0, Math.min(255, r * 255))),
			g: Math.round(Math.max(0, Math.min(255, g * 255))),
			b: Math.round(Math.max(0, Math.min(255, b * 255))),
		};
	}

	// Interpolate between two colors in OKlab space
	static interpolateOklab(color1: string, color2: string, t: number): RGB {
		const rgb1 = ColorUtils.hexToRgb(color1);
		const rgb2 = ColorUtils.hexToRgb(color2);
		const oklab1 = ColorUtils.rgbToOklab(rgb1);
		const oklab2 = ColorUtils.rgbToOklab(rgb2);

		const interpolated: OKLab = {
			L: oklab1.L + (oklab2.L - oklab1.L) * t,
			a: oklab1.a + (oklab2.a - oklab1.a) * t,
			b: oklab1.b + (oklab2.b - oklab1.b) * t,
		};

		return ColorUtils.oklabToRgb(interpolated);
	}

	// Find closest color in palette
	static quantizeToPalette(rgb: RGB): string {
		const paletteColors = Object.values(Palette);
		let closestColor = paletteColors[0].hex;
		let minDistance = Infinity;

		const targetOklab = ColorUtils.rgbToOklab(rgb);

		for (const color of paletteColors) {
			const colorRgb = ColorUtils.hexToRgb(color.hex);
			const colorOklab = ColorUtils.rgbToOklab(colorRgb);

			const distance = Math.sqrt(
				(targetOklab.L - colorOklab.L) ** 2 +
					(targetOklab.a - colorOklab.a) ** 2 +
					(targetOklab.b - colorOklab.b) ** 2,
			);

			if (distance < minDistance) {
				minDistance = distance;
				closestColor = color.hex;
			}
		}

		return closestColor;
	}

	// Floyd-Steinberg dithering
	static ditherFloydSteinberg(
		imageData: Uint8ClampedArray,
		width: number,
		height: number,
	): Uint8ClampedArray {
		const result = new Uint8ClampedArray(imageData);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;

				const oldR = result[i];
				const oldG = result[i + 1];
				const oldB = result[i + 2];

				// Quantize to nearest palette color
				const quantized = ColorUtils.quantizeToPalette({
					r: oldR,
					g: oldG,
					b: oldB,
				});
				const quantizedRgb = ColorUtils.hexToRgb(quantized);

				result[i] = quantizedRgb.r;
				result[i + 1] = quantizedRgb.g;
				result[i + 2] = quantizedRgb.b;

				// Calculate error
				const errR = oldR - quantizedRgb.r;
				const errG = oldG - quantizedRgb.g;
				const errB = oldB - quantizedRgb.b;

				// Distribute error to neighboring pixels
				if (x + 1 < width) {
					const rightI = (y * width + (x + 1)) * 4;
					result[rightI] = Math.max(
						0,
						Math.min(255, result[rightI] + (errR * 7) / 16),
					);
					result[rightI + 1] = Math.max(
						0,
						Math.min(255, result[rightI + 1] + (errG * 7) / 16),
					);
					result[rightI + 2] = Math.max(
						0,
						Math.min(255, result[rightI + 2] + (errB * 7) / 16),
					);
				}

				if (y + 1 < height && x - 1 >= 0) {
					const bottomLeftI = ((y + 1) * width + (x - 1)) * 4;
					result[bottomLeftI] = Math.max(
						0,
						Math.min(255, result[bottomLeftI] + (errR * 3) / 16),
					);
					result[bottomLeftI + 1] = Math.max(
						0,
						Math.min(255, result[bottomLeftI + 1] + (errG * 3) / 16),
					);
					result[bottomLeftI + 2] = Math.max(
						0,
						Math.min(255, result[bottomLeftI + 2] + (errB * 3) / 16),
					);
				}

				if (y + 1 < height) {
					const bottomI = ((y + 1) * width + x) * 4;
					result[bottomI] = Math.max(
						0,
						Math.min(255, result[bottomI] + (errR * 5) / 16),
					);
					result[bottomI + 1] = Math.max(
						0,
						Math.min(255, result[bottomI + 1] + (errG * 5) / 16),
					);
					result[bottomI + 2] = Math.max(
						0,
						Math.min(255, result[bottomI + 2] + (errB * 5) / 16),
					);
				}

				if (y + 1 < height && x + 1 < width) {
					const bottomRightI = ((y + 1) * width + (x + 1)) * 4;
					result[bottomRightI] = Math.max(
						0,
						Math.min(255, result[bottomRightI] + (errR * 1) / 16),
					);
					result[bottomRightI + 1] = Math.max(
						0,
						Math.min(255, result[bottomRightI + 1] + (errG * 1) / 16),
					);
					result[bottomRightI + 2] = Math.max(
						0,
						Math.min(255, result[bottomRightI + 2] + (errB * 1) / 16),
					);
				}
			}
		}

		return result;
	}

	// Simple ordered dithering (Bayer matrix)
	static ditherOrdered(
		imageData: Uint8ClampedArray,
		width: number,
		height: number,
		threshold: number = 128,
	): Uint8ClampedArray {
		const result = new Uint8ClampedArray(imageData);

		// 4x4 Bayer matrix
		const bayerMatrix = [
			[0, 8, 2, 10],
			[12, 4, 14, 6],
			[3, 11, 1, 9],
			[15, 7, 13, 5],
		];

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				const bayerValue = bayerMatrix[y % 4][x % 4] * 16;

				const oldR = result[i];
				const oldG = result[i + 1];
				const oldB = result[i + 2];

				// Add noise based on Bayer matrix
				const noisyR = Math.max(
					0,
					Math.min(255, oldR + (bayerValue - threshold)),
				);
				const noisyG = Math.max(
					0,
					Math.min(255, oldG + (bayerValue - threshold)),
				);
				const noisyB = Math.max(
					0,
					Math.min(255, oldB + (bayerValue - threshold)),
				);

				// Quantize to palette
				const quantized = ColorUtils.quantizeToPalette({
					r: noisyR,
					g: noisyG,
					b: noisyB,
				});
				const quantizedRgb = ColorUtils.hexToRgb(quantized);

				result[i] = quantizedRgb.r;
				result[i + 1] = quantizedRgb.g;
				result[i + 2] = quantizedRgb.b;
			}
		}

		return result;
	}
}
