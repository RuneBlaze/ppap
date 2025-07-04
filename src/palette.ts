/**
 * Represents a color with both hex string and numeric value.
 * The `toString()` method returns the hex string, so it can be used
 * directly where a string is expected (e.g., TextBlock).
 * The `num` property provides the numeric value for Phaser Graphics.
 */
class Color {
	public readonly num: number;

	constructor(public readonly hex: string) {
		this.num = parseInt(hex.substring(1), 16);
	}

	toString(): string {
		return this.hex;
	}
}

export const Palette = {
	BLACK: new Color("#000000"),
	DARK_PURPLE: new Color("#222034"),
	DARK_BURGUNDY: new Color("#45283c"),
	BROWN: new Color("#663931"),
	RUST: new Color("#8f563b"),
	ORANGE: new Color("#df7126"),
	SAND: new Color("#d9a066"),
	BEIGE: new Color("#eec39a"),
	YELLOW: new Color("#fbf236"),
	LIME: new Color("#99e550"),
	GREEN: new Color("#6abe30"),
	DARK_GREEN: new Color("#37946e"),
	OLIVE: new Color("#4b692f"),
	DARK_OLIVE: new Color("#524b24"),
	DARK_TEAL: new Color("#323c39"),
	INDIGO: new Color("#3f3f74"),
	BLUE: new Color("#306082"),
	BRIGHT_BLUE: new Color("#5b6ee1"),
	SKY_BLUE: new Color("#639bff"),
	CYAN: new Color("#5fcde4"),
	LIGHT_BLUE: new Color("#cbdbfc"),
	WHITE: new Color("#ffffff"),
	GRAY: new Color("#9badb7"),
	DARK_GRAY: new Color("#847e87"),
	CHARCOAL: new Color("#696a6a"),
	DARK_CHARCOAL: new Color("#595652"),
	PURPLE: new Color("#76428a"),
	RED: new Color("#ac3232"),
	DARK_RED: new Color("#7f2323"),
	PINK: new Color("#d95763"),
	MAGENTA: new Color("#d77bba"),
	YELLOW_GREEN: new Color("#8f974a"),
	GOLD: new Color("#8a6f30"),
};
