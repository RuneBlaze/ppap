# JRPG UI System Design

## Architecture Overview

```
┌─────────────────┐
│   Scene Layer   │ ← Full compositions (battle UI, menus, dialogs)
├─────────────────┤
│ Component Layer │ ← Reusable UI blocks (Menu, Dialog, ButtonGroup)
├─────────────────┤
│  Layout System  │ ← Positioning, constraints, responsive sizing
├─────────────────┤
│   State Layer   │ ← Cursor, selection, navigation, transitions
├─────────────────┤
│ Primitive Layer │ ← Base drawing (Window, Button, Text, Gauge)
└─────────────────┘
```

## Core Principles

- **Composition over Inheritance**: Build complex UIs from simple primitives
- **Declarative Configuration**: JSON-like configs for UI layouts
- **Reactive State**: UI automatically updates when state changes
- **Pixel-Perfect**: Integer positioning, palette-constrained colors
- **Keyboard-First**: Arrow keys, Enter/Escape, Tab navigation as primary interaction

## Primitive Layer

### Base Primitives

```typescript
interface UIPrimitive {
  bounds: Rectangle;
  visible: boolean;
  focusable: boolean;
  render(graphics: Graphics): void;
  handleInput?(input: KeyboardInput): boolean;
}
```

#### Core JRPG Primitives (Dependency-Ordered)

**🔴 High External Dependencies (Game-Specific Data)**
- `StatusWindow` - Character stats display (HP/MP/XP bars)
  - *Depends on: Character data model, stat definitions*
- `SkillSlot` - Skill icon + name + MP cost + description  
  - *Depends on: Skill data model, MP system*
- `EquipmentSlot` - Gear icon + name + stats comparison
  - *Depends on: Equipment data model, stat comparison logic*
- `CharacterPortrait` - Face + name + level + class
  - *Depends on: Character data model, portrait assets*

**🟡 Medium Dependencies (Asset/Content-Dependent)**
- `ItemSlot` - Icon + name + quantity/description
  - *Depends on: Item data model, item icons*
- `Portrait` - Character face with frame and name
  - *Depends on: Portrait asset system*
- `IconText` - Text with inline sprite icons (items, skills)
  - *Depends on: Icon sprite assets*
- `MessageBox` - Text display with typewriter effect and page breaks
  - *Depends on: Window, TextBlock*
- `ChoiceWindow` - Selection list with cursor highlight
  - *Depends on: List, Cursor*

**🟢 Low Dependencies (Layout/Navigation)**
- `Grid` - Auto-arranged item/skill grids with cursor navigation
  - *Depends on: Container, NavigationController*
- `List` - Vertical scrollable menu with highlighting
  - *Depends on: Container, Cursor*
- `Tabs` - Category switching (Items/Equipment/Key Items)
  - *Depends on: Button, Container*
- `Panel` - Grouped content sections with optional collapsing
  - *Depends on: Container, Button*
- `InputField` - Text entry with cursor and validation
  - *Depends on: TextBlock, Cursor*

**⚪ Zero External Dependencies (Pure Primitives)**
- `Window` - Base bordered container (RPG Maker windowskin)
  - *Depends on: DrawUtils only*
- `TextBlock` - Multi-line, word-wrapped text with RPG font styling
  - *Depends on: fonts.ts only*
- `Button` - Clickable window region with hover states
  - *Depends on: Window, TextBlock*
- `Slider` - Value adjustment (volume, difficulty)
  - *Depends on: Window only*
- `Toggle` - On/off switches with visual indicators
  - *Depends on: Window only*
- `NumberDisplay` - Animated value changes (damage, gold gained)
  - *Depends on: TextBlock only*
- `ProgressBar` - HP/MP/XP with gradient fills and segments
  - *Depends on: DrawUtils gauge system*
- `Gauge` - Circular or linear meters (ATB, charging)
  - *Depends on: DrawUtils only*
- `Cursor` - Selection indicator with animations
  - *Depends on: Graphics primitives only*
- `Divider` - Section separators with decorative elements
  - *Depends on: Graphics primitives only*
- `Container` - Base layout primitive
  - *Depends on: Graphics primitives only*

### Layout Primitives
```typescript
- Container (holds other primitives)
- Grid (automatic positioning in rows/columns)  
- Stack (vertical/horizontal linear layout)
- Flex (flexible sizing with grow/shrink)
```

## State Management

### Keyboard Navigation System

Prioritize keyboard navigation first. Don't worry about mouse *for now*, but always good to leave space for mouse navigation later on.

```typescript
interface KeyboardInput {
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 
       'Enter' | 'Escape' | 'Tab' | 'Space';
  shift: boolean;
  ctrl: boolean;
  repeat: boolean;
}

interface NavigationContext {
  focusableElements: UIPrimitive[];
  currentIndex: number;
  wraparound: boolean;
  gridLayout?: { rows: number; cols: number };
}

class NavigationController {
  contextStack: NavigationContext[];  // For nested menus
  
  // Core navigation methods
  moveFocus(direction: 'up' | 'down' | 'left' | 'right'): void;
  activateSelected(): void;
  goBack(): void;
  pushContext(context: NavigationContext): void;
  popContext(): void;
  
  // Grid navigation for item grids, equipment screens
  moveGridFocus(direction: Direction, wrap: boolean): void;
}

interface CursorState {
  position: Point2D;
  targetPosition: Point2D;
  animationSpeed: number;
  style: 'arrow' | 'highlight' | 'border' | 'glow';
}
```

### Component State
```typescript
interface ComponentState {
  focused: boolean;
  selected: boolean;
  disabled: boolean;
  animationState: 'idle' | 'hover' | 'press' | 'disabled';
}
```

## Component Layer

### Core Components
```typescript
class Menu extends Container {
  items: MenuItem[];
  cursor: CursorController;
  layout: 'vertical' | 'horizontal' | 'grid';
  
  // Auto-handles navigation, selection, callbacks
}

class Dialog extends Window {
  title?: string;
  message: string;
  buttons: DialogButton[];
  
  // Modal behavior, auto-sizing, button management
}

class FormField extends Container {
  label: string;
  input: TextInput | SelectInput | SliderInput;
  validation?: ValidationRule;
}
```

### Advanced Components
```typescript
class DataGrid<T> {
  data: T[];
  columns: GridColumn<T>[];
  cursor: GridCursor;
  
  // Handles large datasets with virtual scrolling
  // Sortable columns, custom renderers
}

class TabContainer {
  tabs: Tab[];
  activeTab: number;
  
  // Tab switching with keyboard navigation
}
```

## Scene System

### Scene Composition
```typescript
interface SceneConfig {
  layout: LayoutConfig;
  components: ComponentConfig[];
  navigation: NavigationConfig;
  transitions: TransitionConfig;
}

class UIScene {
  // Loads from config
  // Manages component lifecycle
  // Handles scene transitions (slide, fade, etc.)
}
```

### RPG Scene Templates

#### Core Game Scenes
- **MainMenu**: New Game/Continue/Options with animated cursor
- **StatusMenu**: Party overview, character stats, equipment
- **InventoryMenu**: Item categories, grid layout, use/discard actions
- **EquipmentMenu**: Character selection, slot-based equipment, stat comparison
- **SkillsMenu**: Skill trees, MP costs, descriptions, learn/forget
- **ShopInterface**: Buy/sell modes, quantity selection, affordability indicators
- **SaveMenu**: Save slot management, file details, confirmation dialogs

#### Battle System Scenes  
- **BattleUI**: Turn order, HP/MP bars, action selection
- **TargetSelection**: Enemy/ally targeting with range indicators
- **ItemUsage**: Quick item access during combat
- **SkillCasting**: MP verification, target selection, animation triggers

#### Dialog & Interaction
- **MessageDialog**: NPC conversations with portrait and typewriter text
- **ChoiceDialog**: Binary/multiple choice with keyboard selection
- **ConfirmDialog**: Yes/No confirmations with default selection
- **InputDialog**: Name entry, save file naming

#### System Menus
- **SettingsMenu**: Audio/video/control options with immediate preview
- **KeyBindingMenu**: Control remapping with conflict detection
- **GameOptionsMenu**: Difficulty, gameplay toggles

## Implementation Strategy

### Phase 1: Pure Primitives (Zero Dependencies)
**Implementation Order - Start Here:**
1. `Container` - Base layout primitive
2. `Cursor` - Selection indicator with animations  
3. `Divider` - Section separators with decorative elements
4. `Window` - Base bordered container (extends existing DrawUtils)
5. `TextBlock` - Multi-line, word-wrapped text (uses fonts.ts)
6. `NumberDisplay` - Animated value changes
7. `ProgressBar` - Extend existing gauge system
8. `Gauge` - Circular/linear meters
9. `Button` - Clickable regions (Window + TextBlock)
10. `Slider` - Value adjustment controls
11. `Toggle` - On/off switches

### Phase 2: Navigation & Layout (Low Dependencies)
**Requires Phase 1 + NavigationController:**
1. `NavigationController` - Keyboard input handling
2. `List` - Vertical scrollable menu (Container + Cursor)
3. `Grid` - Auto-arranged grids (Container + NavigationController)
4. `Tabs` - Category switching (Button + Container)
5. `Panel` - Collapsible sections (Container + Button)
6. `InputField` - Text entry (TextBlock + Cursor)

### Phase 3: Content-Dependent Components (Medium Dependencies)
**Requires asset system:**
1. `IconText` - Text with inline sprites
2. `Portrait` - Character faces with frames
3. `MessageBox` - Text display with typewriter (Window + TextBlock)
4. `ChoiceWindow` - Selection lists (List + Cursor)
5. `ItemSlot` - Item display (requires item data model)

### Phase 4: Game-Specific Components (High Dependencies)
**Requires game data models:**
1. Define data interfaces (Character, Item, Skill, Equipment)
2. `CharacterPortrait` - Face + stats display
3. `StatusWindow` - Character stats with bars
4. `SkillSlot` - Skill display with MP costs
5. `EquipmentSlot` - Gear with stat comparisons

## File Structure
```
src/ui/
├── primitives/     # Base drawing components
├── layout/         # Positioning and sizing
├── state/          # Cursor and navigation
├── components/     # Reusable UI blocks
├── scenes/         # Full screen compositions
└── config/         # JSON scene definitions
```

## Primitive Implementation Details

### Essential RPG Maker-Style Primitives

#### MessageBox
```typescript
class MessageBox extends Window {
  text: string;
  textIndex: number;        // For typewriter effect
  pageBreaks: number[];     // Text pagination
  waitForInput: boolean;    // Pause for user input
  
  // RPG text features
  showText(text: string, speed: number): Promise<void>;
  addChoice(options: string[]): Promise<number>;
  showGold(amount: number): void;
  showItemGained(item: string, quantity: number): void;
}
```

#### ChoiceWindow  
```typescript
class ChoiceWindow extends List {
  choices: string[];
  defaultChoice: number;
  cancelChoice?: number;    // ESC behavior
  
  // Arrow key navigation, Enter to select, ESC to cancel
}
```

#### ItemSlot
```typescript
class ItemSlot extends Container {
  icon: Icon;
  nameText: TextBlock;
  quantityText: TextBlock;
  descriptionText?: TextBlock;
  affordable: boolean;      // For shop displays
  
  // Visual states: normal, selected, disabled, unavailable
}
```

#### StatusWindow
```typescript
class StatusWindow extends Window {
  characterName: TextBlock;
  portrait: Portrait;
  level: NumberDisplay;
  hp: ProgressBar;
  mp: ProgressBar;
  exp: ProgressBar;
  
  // Auto-updates when character data changes
}
```

### Keyboard Behavior Specifications

- **Arrow Keys**: Navigate between focusable elements
- **Enter/Space**: Activate selected element
- **Escape**: Go back/cancel, close menus
- **Tab**: Quick navigation between major sections
- **Page Up/Down**: Scroll through long lists
- **Home/End**: Jump to first/last item in lists

### Layout Behavior

#### Grid Navigation
```typescript
// 3x3 item grid navigation
[0][1][2]
[3][4][5] 
[6][7][8]

// Right from 2 wraps to 0, Down from 6 wraps to 0
```

#### List Navigation  
- Vertical lists wrap top-to-bottom
- Horizontal tabs wrap left-to-right
- Multi-column lists navigate by column first

## Integration with Existing Code

- Extends current `DrawUtils` as primitive foundation
- Uses existing `Palette` for all color theming
- Leverages `fonts.ts` for consistent text rendering
- Maintains pixel-perfect integer positioning
- Builds on existing WindowSkin patterns for consistent visual style