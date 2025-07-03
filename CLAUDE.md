# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a retro-style card game built with TypeScript, Phaser 3, and Vite. The game features pixel art aesthetics, card-based mechanics, and Godot-inspired UI effects including 3D hover animations, smooth transitions, and advanced visual effects.

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

**Game Engine**: Built on Phaser 3 with a single main GameScene that handles all interactions.

**Card System**: 
- `CardSprite` - Individual card rendering with advanced 3D shader effects, smooth animations, and Godot-inspired hover behavior
- `CardManager` - Handles card zones (hand, play, discard), positioning, and card state management
- Cards are positioned using a grid system with fan-out effects for hand display

**Font System**: 
- Multiple retro pixel fonts loaded dynamically via Web Font API
- Font configurations in `src/fonts.ts` with helper functions for Phaser text styling
- All fonts stored in `src/assets/fonts/`

**Visual Systems**:
- Custom WebGL shaders for 3D hover effects (Card3DHoverShader)
- Smooth lerping for position and rotation updates
- Advanced drawing utilities for windowskins and gauges in `src/draw-utils.ts`
- Color palette system in `src/palette.ts`

### File Structure

- `src/main.ts` - Game initialization and main scene
- `src/CardManager.ts` - Card collection and zone management
- `src/CardSprite.ts` - Individual card rendering and effects (complex file with shader system)
- `src/cards.ts` - Card definitions and data structures
- `src/fonts.ts` - Font loading and management
- `src/draw-utils.ts` - UI drawing utilities
- `src/palette.ts` - Color definitions
- `src/assets/` - All game assets (fonts, images, art)

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