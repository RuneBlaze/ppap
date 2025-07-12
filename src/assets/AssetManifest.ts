// src/assets/AssetManifest.ts
// Single source of truth for all game assets

// Image asset keys
export const ImageKeys = {
	CURSOR: "cursor",
	PORTRAIT: "portrait",
	CARD_BACK: "card-back",
	CARD_FLIPPED: "card-flipped",
	BACKGROUND_TEXTURE: "backgroundTexture",
} as const;

// Image asset definitions
export const Images = {
	[ImageKeys.CURSOR]: "src/assets/cursor.png",
	[ImageKeys.PORTRAIT]: "src/assets/portrait.png",
	[ImageKeys.CARD_BACK]: "src/assets/card.png",
	[ImageKeys.CARD_FLIPPED]: "src/assets/card-back.png",
	// Background texture will be generated dynamically
};

// Spritesheet asset keys
export const SpritesheetKeys = {
	ICONS: "icons",
	ENEMIES: "enemies",
	PS_PARTICLE: "ps_particle",
	CARD_ART: "card-art",
} as const;

// Spritesheet asset definitions
export const Spritesheets = {
	[SpritesheetKeys.ICONS]: {
		path: "src/assets/icons_full_16.png",
		frameWidth: 16,
		frameHeight: 16,
	},
	[SpritesheetKeys.ENEMIES]: {
		path: "src/assets/enemies.png",
		frameWidth: 64,
		frameHeight: 64,
	},
	[SpritesheetKeys.PS_PARTICLE]: {
		path: "src/assets/spritesheet_transparent.png",
		frameWidth: 8,
		frameHeight: 8,
	},
	[SpritesheetKeys.CARD_ART]: {
		path: "src/assets/card_art.png",
		frameWidth: 43,
		frameHeight: 60,
	},
};

// Other asset keys
export const OtherKeys = {
	ANIMS_TOML: "anims_toml",
} as const;

// Other asset definitions
export const OtherAssets = {
	[OtherKeys.ANIMS_TOML]: "src/assets/anims.toml",
};

// Type exports for strong typing
export type ImageKey = (typeof ImageKeys)[keyof typeof ImageKeys];
export type SpritesheetKey =
	(typeof SpritesheetKeys)[keyof typeof SpritesheetKeys];
export type OtherKey = (typeof OtherKeys)[keyof typeof OtherKeys];
