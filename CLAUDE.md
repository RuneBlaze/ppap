# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a retro-style card game built with TypeScript, Phaser 3, and Vite. The game features pixel art aesthetics, card-based mechanics, and Godot-inspired UI effects including 3D hover animations, smooth transitions, and advanced visual effects.

When in doubt, think "what would RPG Maker VX do".

## Development Commands

```bash
# Development server with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

ALWAYS use src/palette.ts for colors. Anything outside the palette is strongly discouraged.
ALWAYS run `pnpm build` after several large changes (or at the conclusion) to double check no type errors exist.

## Architecture

### Core Systems

**Game Engine**: Built on Phaser 3 with multiple scenes (BattleScene, ShopScene, GameScene, AnimationDemoScene) managed through routing.

**Scene System**:
- `BattleScene` - Turn-based combat with character stats, action menus, and battle mechanics
- `ShopScene` - UI component demonstration with focus management and navigation
- `GameScene` - Card game mechanics with font demonstrations
- `AnimationDemoScene` - Particle animation and popup effect demonstrations
- `BaseScene` - Shared base class for all scenes with common functionality

**Card System**: 
- `CardSprite` - Individual card rendering with advanced 3D shader effects, smooth animations, and Godot-inspired hover behavior
- `CardManager` - Handles card zones (hand, play, discard), positioning, and card state management
- Cards are positioned using a grid system with fan-out effects for hand display

**UI Framework**:
- Comprehensive UI primitive system (Button, ProgressBar, Gauge, Slider, Toggle, etc.)
- Advanced focus management with layered navigation (`FocusManager`, `GenericFocusStateMachine`)
- Component-based architecture with layout containers and navigation controllers
- Window system with fade transitions and advanced drawing utilities

**Animation & Effects**:
- Particle animation system with predefined animations (`src/base/ps.ts`)
- HD-2D effects including sprite illumination and flash effects
- Popup system for battle feedback (damage numbers, status changes)
- Custom shader system for visual effects

**Font System**: 
- Multiple retro pixel fonts loaded dynamically via Web Font API
- Font configurations in `src/fonts.ts` with helper functions for Phaser text styling
- All fonts stored in `src/assets/fonts/`

**Visual Systems**:
- Custom WebGL shaders for 3D hover effects and brightness/tint effects
- Smooth lerping for position and rotation updates
- Advanced drawing utilities for windowskins and gauges in `src/draw-utils.ts`
- Color palette system in `src/palette.ts`

### File Structure

**Core Game:**
- `src/main.ts` - Game initialization and scene routing
- `src/palette.ts` - Color definitions and palette system
- `src/draw-utils.ts` - UI drawing utilities and icon rendering
- `src/fonts.ts` - Font loading and management

**Scenes:**
- `src/scenes/BaseScene.ts` - Base scene with common functionality
- `src/scenes/BattleScene.ts` - Turn-based combat implementation
- `src/scenes/ShopScene.ts` - UI component demo and focus management
- `src/scenes/GameScene.ts` - Card game mechanics and font demo
- `src/scenes/AnimationDemoScene.ts` - Animation and effects showcase
- `src/scenes/BattleFocusConfig.ts` - Battle scene focus state machine config
- `src/scenes/AnimationDemoFocusConfig.ts` - Animation demo focus config

**Card System:**
- `src/CardManager.ts` - Card collection and zone management
- `src/CardSprite.ts` - Individual card rendering and effects (complex file with shader system)
- `src/cards.ts` - Card definitions and data structures

**UI Framework:**
- `src/ui/primitives/` - Basic UI components (Button, Window, ProgressBar, etc.)
- `src/ui/components/` - Complex UI components (Menu, List)
- `src/ui/layout/` - Layout containers and management
- `src/ui/state/` - Focus management and navigation controllers

**Animation & Effects:**
- `src/base/ps.ts` - Particle animation system
- `src/base/ps_palette.ts` - Particle system color palette
- `src/base/BattleSprite.ts` - Battle sprite with flash effects
- `src/base/ShaderUtils.ts` - Shader utilities (unused)
- `src/base/BrightnessTintShader.ts` - Brightness/tint shader (unused)

**Utilities:**
- `src/color-utils.ts` - Color manipulation utilities
- `src/assets/` - All game assets (fonts, images, art, animations)

### Key Features

**Card Animations**: 
- State-based transitions (initialize → active → resolving → resolved)
- Smooth dragging with velocity-based rotation
- Flip animations with texture switching
- Hover effects with 3D shaders

**Visual Effects**:
- Custom shaders for metallic highlights and perspective distortion
- Smooth movement interpolation using lerp functions
- Oscillating idle animations with random offsets
- Advanced text rendering with compression and shadow effects

## Development Notes

- The project uses pnpm as package manager
- All positioning uses integer coordinates for pixel-perfect rendering
- Card dimensions are fixed at 43x60 pixels
- The game runs at 427x240 resolution with automatic scaling
- Shader uniforms are updated in real-time for smooth 3D effects
- Text rendering includes advanced compression logic for fitting text on small cards

## Import Patterns

The project supports both relative and absolute imports:

**Relative imports** (traditional):
```typescript
import { Container } from "../layout/Container";
import { TextBlock } from "../primitives/TextBlock";
```

**Absolute imports** (preferred with "@" alias):
```typescript
import { Container } from "@/ui/layout/Container";
import { TextBlock } from "@/ui/primitives/TextBlock";
import { palette } from "@/palette";
```

The "@" alias maps to the `src/` directory and is configured in both `tsconfig.json` and `vite.config.ts`. Use absolute imports for cleaner, more maintainable code.