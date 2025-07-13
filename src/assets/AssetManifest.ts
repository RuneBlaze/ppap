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
	[ImageKeys.CURSOR]: "src/assets/images/cursor.png",
	[ImageKeys.PORTRAIT]: "src/assets/images/portrait.png",
	[ImageKeys.CARD_BACK]: "src/assets/images/card.png",
	[ImageKeys.CARD_FLIPPED]: "src/assets/images/card-back.png",
	// Background texture will be generated dynamically
};

// Spritesheet asset keys
export const SpritesheetKeys = {
	ICONS: "icons",
	ENEMIES: "enemies",
	PS_PARTICLE: "ps_particle",
	CARD_ART: "card-art",
	PORTRAITS: "portraits",
} as const;

// Spritesheet asset definitions
export const Spritesheets = {
	[SpritesheetKeys.ICONS]: {
		path: "src/assets/spritesheets/icons_full_16.png",
		frameWidth: 16,
		frameHeight: 16,
	},
	[SpritesheetKeys.ENEMIES]: {
		path: "src/assets/spritesheets/enemies.png",
		frameWidth: 64,
		frameHeight: 64,
	},
	[SpritesheetKeys.PS_PARTICLE]: {
		path: "src/assets/spritesheets/spritesheet_transparent.png",
		frameWidth: 8,
		frameHeight: 8,
	},
	[SpritesheetKeys.CARD_ART]: {
		path: "src/assets/spritesheets/card_art.png",
		frameWidth: 43,
		frameHeight: 60,
	},
	[SpritesheetKeys.PORTRAITS]: {
		path: "src/assets/spritesheets/portraits.png",
		frameWidth: 64,
		frameHeight: 64,
	},
};

// Other asset keys
export const OtherKeys = {
	ANIMS_TOML: "anims_toml",
} as const;

// Other asset definitions
export const OtherAssets = {
	[OtherKeys.ANIMS_TOML]: "src/assets/data/anims.toml",
};

// Type exports for strong typing
export type ImageKey = (typeof ImageKeys)[keyof typeof ImageKeys];
export type SpritesheetKey =
	(typeof SpritesheetKeys)[keyof typeof SpritesheetKeys];
export type OtherKey = (typeof OtherKeys)[keyof typeof OtherKeys];
