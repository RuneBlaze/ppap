# Using the Generic Focus State Machine

This document explains how to use the `GenericFocusStateMachine` to manage focus and UI flow within a scene. The FSM is designed to be powerful and flexible, allowing you to define complex UI interactions in a declarative and manageable way.

## Core Concepts

The FSM is built around three core concepts: **States**, **Events**, and **Transitions**.

### 1. States (`FsmState`)

A **State** is a plain JavaScript object that represents a specific point in your UI's focus flow. Unlike simple enums, states can hold data, which is crucial for creating context-aware UI.

Every state object *must* have an `id` property, which is a unique string identifier.

```typescript
// A simple state with no data
type IdleState = { id: 'idle' };

// A state that knows which character's menu is open
type MenuState = { id: 'menu'; character: Character };
```

### 2. Events (`FsmEvent`)

An **Event** is an object that triggers a potential state change. Like states, events can carry data (a payload).

Every event object *must* have a `type` property, which is a string identifier used to match it to a transition.

```typescript
// An event with no payload
type CloseMenuEvent = { type: 'closeMenu' };

// An event that carries the selected item's data
type ItemSelectedEvent = { type: 'itemSelected'; itemId: string };
```

### 3. Transitions

A **Transition** defines the rule for moving from one state to another in response to an event. It's the "brain" of the FSM. Each transition specifies:

-   `from`: The ID of the state (or an array of IDs) where this transition is valid.
-   `event`: The `type` of the event that triggers this transition.
-   `to`: A **function** that creates the *next state object*. This is the most powerful part of the system. It receives the event and the current state, allowing you to pass data from the event/old state into the new state.
-   `guard` (optional): A function that can prevent a transition from happening even if the `from` state and `event` match.
-   `action` (optional): A function to run side-effects after a transition occurs.

## How to Use It: A Simple Example

Let's imagine a simple settings screen with a main menu and a sound submenu.

### Step 1: Define States and Events

Create a configuration file (e.g., `SettingsFocusConfig.ts`).

```typescript
// --- State Definitions ---
export type SettingsState =
  | { id: 'hidden' }
  | { id: 'mainMenu'; lastIndex: number }
  | { id: 'soundMenu'; volume: number };

// --- Event Definitions ---
export type SettingsEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'goToSoundMenu'; fromIndex: number }
  | { type: 'setVolume'; newVolume: number }
  | { type: 'back' };
```

### Step 2: Create the FSM Configuration

In the same file, define the transitions.

```typescript
import { FSMConfig } from '../ui/state/GenericFocusStateMachine';

export const settingsConfig: FSMConfig<SettingsState, SettingsEvent> = {
  // The machine always starts in this state
  initialState: { id: 'hidden' },

  transitions: [
    // When hidden, the 'open' event shows the main menu
    {
      from: 'hidden',
      event: 'open',
      to: () => ({ id: 'mainMenu', lastIndex: 0 }),
    },
    // From main menu, 'goToSoundMenu' transitions to the sound menu
    {
      from: 'mainMenu',
      event: 'goToSoundMenu',
      to: (event, fromState) => ({
        id: 'soundMenu',
        volume: 50, // Could get this from a save file, etc.
      }),
    },
    // From the sound menu, 'back' returns to the main menu
    {
      from: 'soundMenu',
      event: 'back',
      to: (event, fromState) => ({
        id: 'mainMenu',
        // We can use data from the previous state here if needed
        lastIndex: 0,
      }),
    },
    // The 'close' event, from any state, transitions back to 'hidden'
    {
      from: ['mainMenu', 'soundMenu'],
      event: 'close',
      to: () => ({ id: 'hidden' }),
    },
  ],
};
```

### Step 3: Integrate with a Scene

In your `SettingsScene.ts`, create and use the FSM.

```typescript
import { GenericFocusStateMachine } from '../ui/state/GenericFocusStateMachine';
import { settingsConfig, SettingsState, SettingsEvent } from './SettingsFocusConfig';

export class SettingsScene extends Phaser.Scene {
  private fsm: GenericFocusStateMachine<SettingsState, SettingsEvent>;
  private mainMenu: Menu;
  private soundMenu: SoundMenuUI;

  create() {
    this.fsm = new GenericFocusStateMachine(this, settingsConfig);

    // Create your UI components
    this.mainMenu = new Menu(...);
    this.soundMenu = new SoundMenuUI(...);

    // --- Register components with the FSM ---
    // The FSM will call these onEnter/onExit hooks to show/hide UI
    this.fsm.registerComponent(
      'mainMenu',
      new FocusableMenu(this.mainMenu),
      (state) => this.mainMenu.show(state.lastIndex), // onEnter
      () => this.mainMenu.hide()                      // onExit
    );

    this.fsm.registerComponent(
      'soundMenu',
      new Focusable(this.soundMenu),
      (state) => this.soundMenu.show(state.volume),   // onEnter
      () => this.soundMenu.hide()                     // onExit
    );

    // To start, you might open the menu from a button press
    someButton.on('pointerdown', () => {
      this.fsm.sendEvent({ type: 'open' });
    });
  }
}
```

By following this pattern, you delegate all of the complex "what should be focused now?" logic to the FSM configuration, keeping your Scene code cleaner and focused on *how* to display things, not *when*. 