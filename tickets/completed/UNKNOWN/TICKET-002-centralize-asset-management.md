# TICKET-002: Architect - Centralize Asset Management

**Assignee:** Claude
**Reporter:** Gemini

## Summary

The current asset management system is decentralized, with assets and shaders being loaded and registered across multiple scenes and utility files (`BaseScene`, `BattleScene`, `draw-utils`, etc.). This leads to scattered logic, redundant defensive checks (`if texture.exists`), and an unmanageable asset lifecycle.

This ticket outlines a major architectural refactoring to create a centralized asset loading system using a dedicated "Boot" scene.

## Architectural Plan

### 1. Create an Asset Manifest

Create a new file, `src/assets/AssetManifest.ts`, to serve as a single source of truth for all asset paths and configurations.

**Example `AssetManifest.ts`:**
```typescript
// src/assets/AssetManifest.ts

// Using 'as const' to get string literal types for keys
export const ImageKeys = {
  CURSOR: 'cursor',
  PORTRAIT: 'portrait',
} as const;

export const Images = {
  [ImageKeys.CURSOR]: 'src/assets/cursor.png',
  [ImageKeys.PORTRAIT]: 'src/assets/portrait.png',
};

export const SpritesheetKeys = {
  ICONS: 'icons',
  ENEMIES: 'enemies',
  PS_PARTICLE: 'ps_particle',
} as const;

export const Spritesheets = {
  [SpritesheetKeys.ICONS]: { path: 'src/assets/icons_full_16.png', frameWidth: 16, frameHeight: 16 },
  [SpritesheetKeys.ENEMIES]: { path: 'src/assets/enemies.png', frameWidth: 64, frameHeight: 64 },
  [SpritesheetKeys.PS_PARTICLE]: { path: 'src/assets/spritesheet_transparent.png', frameWidth: 8, frameHeight: 8 },
};

// ... Add other asset types like Fonts, Shaders, etc.
```

### 2. Implement the `BootScene`

Create a new scene file `src/scenes/BootScene.ts`. This will be the new entry point for the game.

-   **`preload()`:**
    -   Iterate through the `AssetManifest` and load all images, spritesheets, fonts, etc.
    -   Register all game shaders here (e.g., `NoisePatternShader`, `StylizedDitherShader`).
    -   (Optional) Display a loading bar.
-   **`create()`:**
    -   Once loading is complete, start the next scene (e.g., `BattleScene` or a future `MainMenuScene`).
    -   Example: `this.scene.start("BattleScene");`

### 3. Update Game Configuration

Modify the main Phaser game config (likely in `src/main.ts`) to make `BootScene` the first scene to be loaded.

### 4. Refactor All Other Scenes and Utilities

-   **Remove all asset loading logic:** Delete all `this.load.*` calls from every other scene (`BaseScene`, `BattleScene`, `ShopScene`, `SocietyScene`).
-   **Remove `DrawUtils.preloadAssets()`:** Delete this method and its calls.
-   **Remove all defensive checks:** Delete all `if (!scene.textures.exists(...))` blocks.
-   **Remove all shader registration calls:** Delete calls to `registerStylizedDitherShader` and `NoisePatternShader.registerShader` from all scenes. This is now handled by the `BootScene`.
-   **Remove `preload()` and `preloadSceneAssets()` methods** from scenes if they become empty.

## Acceptance Criteria

-   All assets are loaded once at the start of the game.
-   There are no more asset loading calls in any scene besides `BootScene`.
-   The game runs correctly, with all assets and shaders available when needed.
-   The code is cleaner and easier to maintain.
