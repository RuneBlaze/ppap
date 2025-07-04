/**
 * Generic FSM-based Focus Management System
 * 
 * A completely configurable state machine that scenes can define their own
 * states, events, and transitions for. No hardcoded behavior.
 */

// Basic interface for any object that can be focused.
export interface Focusable {
	activate(): void;
	deactivate(): void;
	destroy(): void;
}

// "Essential protocol" for state and event objects.
// Any object conforming to these can be used with the FSM.
export interface FsmState {
	id: string;
}

export interface FsmEvent {
	type: string;
}

export interface StateTransition<
	TState extends FsmState,
	TEvent extends FsmEvent,
> {
	from: string | string[];
	to: (event: TEvent, fromState: TState) => TState;
	event: string;
	guard?: (event: TEvent, fromState: TState) => boolean;
	action?: (fromState: TState, toState: TState, event: TEvent) => void;
}

export interface StateEntry<TState extends FsmState> {
	state: TState;
	component: Focusable | null;
	onEnter?: (state: TState, previousState?: TState) => void;
	onExit?: (state: TState, nextState: TState) => void;
}

export interface FSMConfig<TState extends FsmState, TEvent extends FsmEvent> {
	initialState: TState;
	transitions: StateTransition<TState, TEvent>[];
}

export class GenericFocusStateMachine<
	TState extends FsmState,
	TEvent extends FsmEvent,
> extends Phaser.Events.EventEmitter
{
	private currentState: TState;
	private states: Map<string, StateEntry<TState>> = new Map();
	private transitions: StateTransition<TState, TEvent>[] = [];
	private scene: Phaser.Scene;
	private keydownListener: (event: KeyboardEvent) => void;

	constructor(scene: Phaser.Scene, config: FSMConfig<TState, TEvent>) {
		super();
		this.scene = scene;
		this.currentState = config.initialState;
		this.keydownListener = this.handleKeyDown.bind(this);
		this.scene.input.keyboard?.on("keydown", this.keydownListener);

		// The initial state must be registered
		this.states.set(this.currentState.id, {
			state: this.currentState,
			component: null,
		});

		this.initializeTransitions(config.transitions);
	}

	private initializeTransitions(
		transitions: StateTransition<TState, TEvent>[],
	): void {
		this.transitions = [...transitions];
	}

	/**
	 * Register a component and lifecycle hooks for a specific state ID.
	 */
	registerComponent(
		stateId: string,
		component: Focusable,
		onEnter?: (state: TState, previousState?: TState) => void,
		onExit?: (state: TState, nextState: TState) => void,
	): void {
		// Ensure a state entry exists. This allows registering components
		// before the state itself has been entered for the first time.
		if (!this.states.has(stateId)) {
			// We create a "proxy" state entry. The full state object
			// will be populated when we actually transition to it.
			this.states.set(stateId, { state: { id: stateId } as TState, component: null });
		}
		
		const stateEntry = this.states.get(stateId);
		if (stateEntry) {
			stateEntry.component = component;
			stateEntry.onEnter = onEnter;
			stateEntry.onExit = onExit;
		}
	}

	/**
	 * Unregister a component from a state
	 */
	unregisterComponent(stateId: string): void {
		const stateEntry = this.states.get(stateId);
		if (stateEntry) {
			if (stateEntry.component) {
				stateEntry.component.deactivate();
				// Don't destroy component here, just deactivate. The creator of the component should manage its lifecycle.
			}
			stateEntry.component = null;
			stateEntry.onEnter = undefined;
			stateEntry.onExit = undefined;
		}
	}

	/**
	 * Send an event to the state machine
	 */
	sendEvent(event: TEvent): boolean {
		const fromId = this.currentState.id;
		const transition = this.transitions.find((t) => {
			const fromMatch = Array.isArray(t.from)
				? t.from.includes(fromId)
				: t.from === fromId;
			return fromMatch && t.event === event.type;
		});

		if (!transition) {
			console.warn(
				`No transition found for event '${event.type}' from state '${this.currentState.id}'`,
			);
			return false;
		}

		// Check guard condition if present
		if (transition.guard && !transition.guard(event, this.currentState)) {
			return false;
		}

		// Create the next state
		const nextState = transition.to(event, this.currentState);

		// Execute transition
		this.transitionTo(nextState, event);

		// Execute transition action if present
		if (transition.action) {
			transition.action(this.currentState, nextState, event);
		}

		return true;
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: TState, triggerEvent: TEvent): void {
		const oldState = this.currentState;
		const oldStateEntry = this.states.get(oldState.id);
		
		// Ensure the new state is registered
		if (!this.states.has(newState.id)) {
			this.states.set(newState.id, { state: newState, component: null });
		}
		const newStateEntry = this.states.get(newState.id)!;
		// Update state object in case it's a new instance of an existing ID
		newStateEntry.state = newState;


		// Exit old state
		if (oldStateEntry) {
			// The onExit hook from the old state's registration is called
			if (oldStateEntry.onExit) {
				oldStateEntry.onExit(oldState, newState);
			}
			if (oldStateEntry.component) {
				oldStateEntry.component.deactivate();
			}
		}

		// Update current state
		this.currentState = newState;

		// Enter new state
		// The onEnter hook from the new state's registration is called
		if (newStateEntry.onEnter) {
			newStateEntry.onEnter(newState, oldState);
		}
		if (newStateEntry.component) {
			newStateEntry.component.activate();
		}


		// Emit state change event
		this.emit("stateChanged", {
			oldState,
			newState,
			event: triggerEvent,
		});

		console.log(`State transition: ${oldState.id} -> ${newState.id}`);
	}

	/**
	 * Force transition to a specific state (use carefully)
	 */
	setState(state: TState): void {
		// Create a dummy event for the transition metadata
		const dummyEvent = { type: "forceSetState" } as TEvent;
		this.transitionTo(state, dummyEvent);
	}

	/**
	 * Get the current state object
	 */
	getCurrentState(): TState {
		return this.currentState;
	}

	/**
	 * Get the component for the current state
	 */
	getCurrentComponent(): Focusable | null {
		const stateEntry = this.states.get(this.currentState.id);
		return stateEntry ? stateEntry.component : null;
	}

	/**
	 * Check if a transition is valid
	 */
	canTransition(event: TEvent): boolean {
		const fromId = this.currentState.id;
		const transition = this.transitions.find((t) => {
			const fromMatch = Array.isArray(t.from)
				? t.from.includes(fromId)
				: t.from === fromId;
			return fromMatch && t.event === event.type;
		});

		if (!transition) {
			return false;
		}

		return !transition.guard || transition.guard(event, this.currentState);
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
				// Scene should define what "cancel" means
				this.emit("cancelRequested");
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
		currentState: TState;
		availableTransitions: string[];
		states: string[];
	} {
		const fromId = this.currentState.id;
		const availableTransitions = this.transitions
			.filter((t) => {
				const fromMatch = Array.isArray(t.from)
					? t.from.includes(fromId)
					: t.from === fromId;
				return fromMatch;
			})
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
		const currentStateEntry = this.states.get(this.currentState.id);
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