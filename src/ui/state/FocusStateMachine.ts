/**
 * FSM-based Focus Management System
 * 
 * Replaces the complex token-based system with a simple state machine.
 * Only one component can be focused at a time, with well-defined transitions.
 */

export enum FocusState {
	IDLE = "idle",
	ACTION_MENU = "actionMenu",
	SKILL_MENU = "skillMenu",
	TARGET_MENU = "targetMenu",
	ITEM_MENU = "itemMenu",
}

export enum FocusEvent {
	START_PLAYER_TURN = "startPlayerTurn",
	SELECT_ATTACK = "selectAttack",
	SELECT_SKILL = "selectSkill",
	SELECT_ITEM = "selectItem",
	BACK = "back",
	CANCEL = "cancel",
	CONFIRM_ACTION = "confirmAction",
	END_TURN = "endTurn",
}

export interface Focusable {
	activate(): void;
	deactivate(): void;
	destroy(): void;
}

interface StateTransition {
	from: FocusState;
	to: FocusState;
	event: FocusEvent;
	guard?: () => boolean;
	action?: () => void;
}

interface StateEntry {
	state: FocusState;
	component: Focusable | null;
	onEnter?: () => void;
	onExit?: () => void;
}

export class FocusStateMachine extends Phaser.Events.EventEmitter {
	private currentState: FocusState = FocusState.IDLE;
	private states: Map<FocusState, StateEntry> = new Map();
	private transitions: StateTransition[] = [];
	private scene: Phaser.Scene;
	private keydownListener: (event: KeyboardEvent) => void;

	constructor(scene: Phaser.Scene) {
		super();
		this.scene = scene;
		this.keydownListener = this.handleKeyDown.bind(this);
		this.scene.input.keyboard?.on("keydown", this.keydownListener);

		this.initializeStates();
		this.initializeTransitions();
	}

	private initializeStates(): void {
		// Register default states
		this.states.set(FocusState.IDLE, {
			state: FocusState.IDLE,
			component: null,
		});

		this.states.set(FocusState.ACTION_MENU, {
			state: FocusState.ACTION_MENU,
			component: null,
		});

		this.states.set(FocusState.SKILL_MENU, {
			state: FocusState.SKILL_MENU,
			component: null,
		});

		this.states.set(FocusState.TARGET_MENU, {
			state: FocusState.TARGET_MENU,
			component: null,
		});

		this.states.set(FocusState.ITEM_MENU, {
			state: FocusState.ITEM_MENU,
			component: null,
		});
	}

	private initializeTransitions(): void {
		// Define allowed state transitions
		this.transitions = [
			// Starting player turn
			{
				from: FocusState.IDLE,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.START_PLAYER_TURN,
			},

			// From action menu
			{
				from: FocusState.ACTION_MENU,
				to: FocusState.SKILL_MENU,
				event: FocusEvent.SELECT_SKILL,
			},
			{
				from: FocusState.ACTION_MENU,
				to: FocusState.TARGET_MENU,
				event: FocusEvent.SELECT_ATTACK,
			},
			{
				from: FocusState.ACTION_MENU,
				to: FocusState.ITEM_MENU,
				event: FocusEvent.SELECT_ITEM,
			},

			// From skill menu
			{
				from: FocusState.SKILL_MENU,
				to: FocusState.TARGET_MENU,
				event: FocusEvent.SELECT_ATTACK, // Skill selected, now need target
			},
			{
				from: FocusState.SKILL_MENU,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.BACK,
			},
			{
				from: FocusState.SKILL_MENU,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.CANCEL,
			},

			// From target menu
			{
				from: FocusState.TARGET_MENU,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.BACK,
			},
			{
				from: FocusState.TARGET_MENU,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.CANCEL,
			},
			{
				from: FocusState.TARGET_MENU,
				to: FocusState.SKILL_MENU,
				event: FocusEvent.BACK,
				guard: () => this.shouldReturnToSkillMenu(),
			},

			// From item menu
			{
				from: FocusState.ITEM_MENU,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.BACK,
			},
			{
				from: FocusState.ITEM_MENU,
				to: FocusState.ACTION_MENU,
				event: FocusEvent.CANCEL,
			},

			// Action confirmed - return to idle
			{
				from: FocusState.ACTION_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.CONFIRM_ACTION,
			},
			{
				from: FocusState.TARGET_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.CONFIRM_ACTION,
			},
			{
				from: FocusState.ITEM_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.CONFIRM_ACTION,
			},

			// End turn - return to idle
			{
				from: FocusState.ACTION_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.END_TURN,
			},
			{
				from: FocusState.SKILL_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.END_TURN,
			},
			{
				from: FocusState.TARGET_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.END_TURN,
			},
			{
				from: FocusState.ITEM_MENU,
				to: FocusState.IDLE,
				event: FocusEvent.END_TURN,
			},
		];
	}

	private shouldReturnToSkillMenu(): boolean {
		// Logic to determine if we should return to skill menu or action menu
		// This could be based on context stored in the state machine
		return false; // Default to action menu for now
	}

	/**
	 * Register a component for a specific state
	 */
	registerState(
		state: FocusState,
		component: Focusable,
		onEnter?: () => void,
		onExit?: () => void,
	): void {
		const stateEntry = this.states.get(state);
		if (stateEntry) {
			stateEntry.component = component;
			stateEntry.onEnter = onEnter;
			stateEntry.onExit = onExit;
		}
	}

	/**
	 * Unregister a component from a state
	 */
	unregisterState(state: FocusState): void {
		const stateEntry = this.states.get(state);
		if (stateEntry) {
			if (stateEntry.component) {
				stateEntry.component.deactivate();
			}
			stateEntry.component = null;
			stateEntry.onEnter = undefined;
			stateEntry.onExit = undefined;
		}
	}

	/**
	 * Send an event to the state machine
	 */
	sendEvent(event: FocusEvent): boolean {
		const transition = this.transitions.find(
			(t) => t.from === this.currentState && t.event === event,
		);

		if (!transition) {
			console.warn(
				`No transition found for event ${event} from state ${this.currentState}`,
			);
			return false;
		}

		// Check guard condition if present
		if (transition.guard && !transition.guard()) {
			return false;
		}

		// Execute transition
		this.transitionTo(transition.to);

		// Execute transition action if present
		if (transition.action) {
			transition.action();
		}

		return true;
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: FocusState): void {
		const oldState = this.currentState;
		const oldStateEntry = this.states.get(oldState);
		const newStateEntry = this.states.get(newState);

		// Exit old state
		if (oldStateEntry) {
			if (oldStateEntry.component) {
				oldStateEntry.component.deactivate();
			}
			if (oldStateEntry.onExit) {
				oldStateEntry.onExit();
			}
		}

		// Update current state
		this.currentState = newState;

		// Enter new state
		if (newStateEntry) {
			if (newStateEntry.component) {
				newStateEntry.component.activate();
			}
			if (newStateEntry.onEnter) {
				newStateEntry.onEnter();
			}
		}

		// Emit state change event
		this.emit("stateChanged", {
			oldState,
			newState,
			event: event,
		});

		console.log(`State transition: ${oldState} -> ${newState}`);
	}

	/**
	 * Force transition to a specific state (use carefully)
	 */
	setState(state: FocusState): void {
		this.transitionTo(state);
	}

	/**
	 * Get the current state
	 */
	getCurrentState(): FocusState {
		return this.currentState;
	}

	/**
	 * Get the component for the current state
	 */
	getCurrentComponent(): Focusable | null {
		const stateEntry = this.states.get(this.currentState);
		return stateEntry ? stateEntry.component : null;
	}

	/**
	 * Check if a transition is valid
	 */
	canTransition(event: FocusEvent): boolean {
		const transition = this.transitions.find(
			(t) => t.from === this.currentState && t.event === event,
		);

		if (!transition) {
			return false;
		}

		return !transition.guard || transition.guard();
	}

	/**
	 * Handle keyboard input
	 */
	private handleKeyDown(event: KeyboardEvent): void {
		switch (event.key) {
			case "Tab":
				event.preventDefault();
				// Tab navigation within current component
				const currentComponent = this.getCurrentComponent();
				if (currentComponent && "focusNext" in currentComponent) {
					if (event.shiftKey) {
						(currentComponent as any).focusPrevious();
					} else {
						(currentComponent as any).focusNext();
					}
				}
				break;

			case "Escape":
				event.preventDefault();
				// Send cancel event
				this.sendEvent(FocusEvent.CANCEL);
				break;

			case "Enter":
				event.preventDefault();
				// Current component should handle Enter
				const component = this.getCurrentComponent();
				if (component && "handleEnter" in component) {
					(component as any).handleEnter();
				}
				break;
		}
	}

	/**
	 * Get debug information
	 */
	getDebugInfo(): {
		currentState: FocusState;
		availableTransitions: FocusEvent[];
		states: string[];
	} {
		const availableTransitions = this.transitions
			.filter((t) => t.from === this.currentState)
			.map((t) => t.event);

		return {
			currentState: this.currentState,
			availableTransitions,
			states: Array.from(this.states.keys()),
		};
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		// Deactivate current state
		const currentStateEntry = this.states.get(this.currentState);
		if (currentStateEntry?.component) {
			currentStateEntry.component.deactivate();
		}

		// Clean up all registered components
		for (const stateEntry of this.states.values()) {
			if (stateEntry.component) {
				stateEntry.component.destroy();
			}
		}

		this.states.clear();
		this.transitions = [];

		// Remove keyboard listener
		this.scene.input.keyboard?.off("keydown", this.keydownListener);

		// Clean up event emitter
		this.removeAllListeners();
	}
}