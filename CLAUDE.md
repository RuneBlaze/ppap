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

# Run tests
pnpm test

# Code formatting and linting (use these to fix basic code issues)
pnpm format  # Format code with Biome
pnpm lint    # Lint and auto-fix issues with Biome
pnpm check   # Format + lint + auto-fix in one command
```

ALWAYS use src/palette.ts for colors. Anything outside the palette is strongly discouraged.

### Available Palette Colors

```typescript
Palette.BLACK, Palette.DARK_PURPLE, Palette.DARK_BURGUNDY, Palette.BROWN,
Palette.RUST, Palette.ORANGE, Palette.SAND, Palette.BEIGE, Palette.YELLOW,
Palette.LIME, Palette.GREEN, Palette.DARK_GREEN, Palette.OLIVE, Palette.DARK_OLIVE,
Palette.DARK_TEAL, Palette.INDIGO, Palette.BLUE, Palette.BRIGHT_BLUE, Palette.SKY_BLUE,
Palette.CYAN, Palette.LIGHT_BLUE, Palette.WHITE, Palette.GRAY, Palette.DARK_GRAY,
Palette.CHARCOAL, Palette.DARK_CHARCOAL, Palette.PURPLE, Palette.RED, Palette.DARK_RED,
Palette.PINK, Palette.MAGENTA, Palette.YELLOW_GREEN, Palette.GOLD
```

Use `Palette.COLOR_NAME.hex` for hex strings, `Palette.COLOR_NAME.num` for numeric values, or just `Palette.COLOR_NAME` where string coercion applies.
ALWAYS run `pnpm build` after several large changes (or at the conclusion) to double check no type errors exist.
ALWAYS run `pnpm check` to automatically fix basic code issues (unused imports, formatting, etc.) before committing changes.

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
- `src/scenes/SocietyScene.ts` - Society/social mechanics scene
- `src/scenes/BattleResolver.ts` - Battle outcome resolution logic
- `src/scenes/Pawn.ts` - Character/pawn movement and grid positioning
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
- `src/base/ShaderUtils.ts` - Shared GLSL utilities including OKLab color space conversion

**Game Systems:**
- `src/battle/` - Battle state management and type definitions separate from scenes
- `src/dice/` - Dice rolling system with lexer/parser (simple `evaluate(source, context)` interface)
- `src/grid/` - Grid utilities and positioning logic
- `src/ai/` - AI todo management tools

**Shaders & Effects:**
- `src/shaders/` - Additional shader effects (Hover3D, NoisePattern)

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
- **Pixel Perfect Rule**: Avoid scaling sprites/images when pixel perfectness is important. Use alpha/position animations instead of scale animations for UI elements to maintain crisp pixel art
- NEVER deprecate things. Just remove things. We aren't doing public APIs.

## Common Pitfalls & Gotchas

**Shader Registration**: Shaders must be registered with the renderer before applying to game objects. Always check WebGL availability and wrap in try-catch blocks.

**Focus Management**: Multiple focus systems can conflict (FocusManager, GenericFocusStateMachine, scene-specific navigation). Ensure only one system manages focus per UI context.

**Scene Lifecycle**: Scenes accumulate state across transitions. Clean up timers, event listeners, and object references in scene shutdown to prevent memory leaks.

**Card Zone Management**: Card positioning depends on zone state. Verify zone exists before position calculations to avoid runtime errors.

**Font Loading**: Fonts load asynchronously. Ensure fonts are loaded before creating text objects, or use fallbacks.

**Color Consistency**: Always use `src/palette.ts` colors. Direct hex colors outside the palette break the visual consistency and dithering effects.

## General Coding Guidelines (Reminders)

- **Embrace Change:** Do not preserve backward compatibility when making API changes unless explicitly required.
- **Ruthless Deletion:** Delete unused code; do not comment it out.
- **Utility Preference:** When applicable and offering a readability or efficiency advantage, prefer using `remeda` and `ts-pattern` as utility libraries.
- **Testing Philosophy:** By default, do not write unit tests for UI components. Tests are encouraged only for self-contained, functional-core logic (e.g., parsers, algorithms). When writing tests, use `vitest` and keep them simple (max 3 asserts per test).

## Testing Guidelines

- Use **vitest** for all testing (configured automatically via Vite)
- Place test files adjacent to source files with `.test.ts` extension
- Test files should import from relative paths to the module under test
- For deterministic tests, assert exact values (e.g., `(2 + 3) * 4 = 20`)
- For non-deterministic features like dice rolls, test ranges and types
- Keep tests focused and minimal - each test should verify one specific behavior
- Use descriptive test names that explain the expected behavior

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

---

## Workflow & GitHub Issues

To maintain a clear, organized, and asynchronous workflow, we use GitHub Issues for task management. All significant changes to the codebase should be managed through this process.

### The Process

1.  **Architect (Gemini):** When a new feature, refactor, or bugfix is requested, Gemini's role is to first understand the request in the context of the existing codebase. This involves reading relevant files, analyzing the current architecture, and identifying potential impacts.
2.  **Issue Creation (Gemini):** After analysis, Gemini will create a GitHub issue. To avoid shell injection issues with complex markdown, the issue body will be written to a temporary file and then passed to the `gh` CLI.
    
    First, write the body to a temp file:
    ```bash
    cat <<'EOF' > temp_issue_body.md
    ## Summary
    Brief description of the task and its purpose.
    
    ## Architectural Plan
    Detailed implementation steps and task breakdown.
    
    ## Architectural Justification
    Explanation of why this approach is being taken, referencing our principles.
    EOF
    ```

    Then, create the issue using the file:
    ```bash
    gh issue create --assignee @me --label enhancement --title "Feature: Add dice rolling system" --body-file temp_issue_body.md
    ```

    Finally, remove the temporary file:
    ```bash
    rm temp_issue_body.md
    ```
3.  **Execution (Claude):** Your role is to execute the plan outlined in the issue. Follow the instructions precisely, adhering to the project's coding standards and architectural principles. Reference the issue number in commit messages.
4.  **Verification (Claude/Gemini):** After implementation, the changes should be verified. This may involve running builds (`pnpm build`), tests, or simply confirming the application runs as expected. Both assistants are responsible for ensuring the final result is correct.
5.  **Closure (Claude):** When implementation is complete, close the issue with a reference to the final commit:
    ```bash
    gh issue close 123 --comment "Completed in commit abc123"
    ```

### GitHub Issue Commands

```bash
# Create issue with proper body formatting
# 1. Write the body to a temp file
cat <<'EOF' > temp_issue_body.md
## Summary
Task description

## Architectural Plan
Implementation steps

## Architectural Justification
Why this approach
EOF

# 2. Create the issue from the file
gh issue create --assignee @me --label enhancement --title "Title" --body-file temp_issue_body.md

# 3. (Optional) Remove the temp file
rm temp_issue_body.md

# List active issues assigned to you
gh issue list --assignee @me --state open

# View issue details
gh issue view 123

# Close completed issue
gh issue close 123 --comment "Completed in commit abc123"

# Add comment to issue
gh issue comment 123 --body "Progress update"
```

This process ensures that every change is well-planned, architecturally sound, and documented for future reference.
