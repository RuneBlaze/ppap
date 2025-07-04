/**
 * FocusManager - Enforces linear focus semantics across multiple navigation controllers
 *
 * Core Invariant: At most one focusable component can be active at any time.
 * This prevents the "multiple active components" problem by design.
 *
 * Type Theory Approach:
 * - Uses branded types to ensure only registered components can receive focus
 * - Maintains a single "active" reference (Option<FocusToken>)
 * - All focus transitions are centralized and atomic
 */

export type FocusToken = string & { __brand: "FocusToken" };

export interface Focusable {
	activate(): void;
	deactivate(): void;
	destroy(): void;
}

interface FocusRegistration {
	token: FocusToken;
	component: Focusable;
	name: string;
}

interface FocusLayer {
	name: string;
	focusOrder: FocusToken[];
	currentFocus: FocusToken | null;
}

export class FocusManager extends Phaser.Events.EventEmitter {
	private registrations: Map<FocusToken, FocusRegistration> = new Map();
	private layerStack: FocusLayer[] = [];
	private scene: Phaser.Scene;
	private keydownListener: (event: KeyboardEvent) => void;

	constructor(scene: Phaser.Scene) {
		super();
		this.scene = scene;
		this.keydownListener = this.handleKeyDown.bind(this);
		this.scene.input.keyboard?.on("keydown", this.keydownListener);

		// Create default layer
		this.layerStack.push({
			name: "default",
			focusOrder: [],
			currentFocus: null,
		});
	}

	/**
	 * Register a focusable component with a unique token
	 * Returns a branded token that can only be used with this manager
	 */
	register(name: string, component: Focusable, layerName?: string): FocusToken {
		const token = `focus_${name}_${Date.now()}` as FocusToken;

		const registration: FocusRegistration = {
			token,
			component,
			name,
		};

		this.registrations.set(token, registration);

		// Add to specified layer or current layer
		const targetLayer = layerName
			? this.getOrCreateLayer(layerName)
			: this.getCurrentLayer();
		targetLayer.focusOrder.push(token);

		// Deactivate by default - only explicit focus() calls should activate
		component.deactivate();

		return token;
	}

	/**
	 * Unregister a component (typically on destroy)
	 */
	unregister(token: FocusToken): void {
		// Remove from current layer's focus
		const currentLayer = this.getCurrentLayer();
		if (currentLayer.currentFocus === token) {
			currentLayer.currentFocus = null;
		}

		// Remove from all layers
		this.layerStack.forEach((layer) => {
			layer.focusOrder = layer.focusOrder.filter((t) => t !== token);
		});

		this.registrations.delete(token);
	}

	/**
	 * Focus a specific component by token
	 * This is the ONLY way to activate a component - enforces linearity
	 */
	focus(token: FocusToken): boolean {
		const registration = this.registrations.get(token);
		if (!registration) {
			console.warn(`FocusManager: Token ${token} not found`);
			return false;
		}

		const currentLayer = this.getCurrentLayer();

		// Deactivate current focus (if any)
		if (currentLayer.currentFocus) {
			const currentReg = this.registrations.get(currentLayer.currentFocus);
			if (currentReg) {
				currentReg.component.deactivate();
			}
		}

		// Activate new focus
		registration.component.activate();
		const oldFocus = currentLayer.currentFocus;
		currentLayer.currentFocus = token;

		// Emit focus change event
		this.emit("focusChanged", {
			newFocus: token,
			oldFocus,
			newName: registration.name,
			oldName: oldFocus ? this.registrations.get(oldFocus)?.name : null,
			layer: currentLayer.name,
		});

		return true;
	}

	/**
	 * Focus the first registered component in current layer
	 */
	focusFirst(): boolean {
		const currentLayer = this.getCurrentLayer();
		if (currentLayer.focusOrder.length === 0) return false;
		return this.focus(currentLayer.focusOrder[0]);
	}

	/**
	 * Focus the next component in registration order
	 */
	focusNext(): boolean {
		const currentLayer = this.getCurrentLayer();
		if (currentLayer.focusOrder.length === 0) return false;

		if (!currentLayer.currentFocus) {
			return this.focusFirst();
		}

		const currentIndex = currentLayer.focusOrder.indexOf(
			currentLayer.currentFocus,
		);
		const nextIndex = (currentIndex + 1) % currentLayer.focusOrder.length;
		return this.focus(currentLayer.focusOrder[nextIndex]);
	}

	/**
	 * Focus the previous component in registration order
	 */
	focusPrevious(): boolean {
		const currentLayer = this.getCurrentLayer();
		if (currentLayer.focusOrder.length === 0) return false;

		if (!currentLayer.currentFocus) {
			return this.focusFirst();
		}

		const currentIndex = currentLayer.focusOrder.indexOf(
			currentLayer.currentFocus,
		);
		const prevIndex =
			currentIndex === 0
				? currentLayer.focusOrder.length - 1
				: currentIndex - 1;
		return this.focus(currentLayer.focusOrder[prevIndex]);
	}

	/**
	 * Remove focus from all components in current layer
	 */
	blur(): void {
		const currentLayer = this.getCurrentLayer();
		if (currentLayer.currentFocus) {
			const registration = this.registrations.get(currentLayer.currentFocus);
			if (registration) {
				registration.component.deactivate();
			}

			const oldFocus = currentLayer.currentFocus;
			currentLayer.currentFocus = null;

			this.emit("focusChanged", {
				newFocus: null,
				oldFocus,
				newName: null,
				oldName: this.registrations.get(oldFocus)?.name || null,
				layer: currentLayer.name,
			});
		}
	}

	/**
	 * Push a new focus layer (for submenus, dialogs, etc.)
	 */
	pushLayer(layerName: string): void {
		// Blur current layer
		this.blur();

		// Create new layer
		const newLayer: FocusLayer = {
			name: layerName,
			focusOrder: [],
			currentFocus: null,
		};

		this.layerStack.push(newLayer);

		this.emit("layerChanged", {
			action: "push",
			layerName,
			depth: this.layerStack.length,
		});
	}

	/**
	 * Pop the current focus layer (return to previous layer)
	 */
	popLayer(): boolean {
		if (this.layerStack.length <= 1) {
			console.warn("FocusManager: Cannot pop the default layer");
			return false;
		}

		// Blur current layer
		this.blur();

		// Remove current layer
		const poppedLayer = this.layerStack.pop()!;

		// Unregister all components from the popped layer
		poppedLayer.focusOrder.forEach((token) => {
			const registration = this.registrations.get(token);
			if (registration) {
				registration.component.destroy();
				this.registrations.delete(token);
			}
		});

		this.emit("layerChanged", {
			action: "pop",
			layerName: poppedLayer.name,
			depth: this.layerStack.length,
		});

		return true;
	}

	/**
	 * Get current focus information
	 */
	getCurrentFocus(): { token: FocusToken; name: string; layer: string } | null {
		const currentLayer = this.getCurrentLayer();
		if (!currentLayer.currentFocus) return null;

		const registration = this.registrations.get(currentLayer.currentFocus);
		return registration
			? {
					token: registration.token,
					name: registration.name,
					layer: currentLayer.name,
				}
			: null;
	}

	/**
	 * Get the current focus layer
	 */
	private getCurrentLayer(): FocusLayer {
		return this.layerStack[this.layerStack.length - 1];
	}

	/**
	 * Get or create a named layer
	 */
	private getOrCreateLayer(layerName: string): FocusLayer {
		let layer = this.layerStack.find((l) => l.name === layerName);
		if (!layer) {
			layer = {
				name: layerName,
				focusOrder: [],
				currentFocus: null,
			};
			this.layerStack.push(layer);
		}
		return layer;
	}

	/**
	 * Handle Tab key for focus switching
	 */
	private handleKeyDown(event: KeyboardEvent): void {
		if (event.key === "Tab") {
			event.preventDefault();

			if (event.shiftKey) {
				this.focusPrevious();
			} else {
				this.focusNext();
			}
		}
	}

	/**
	 * Get debug information about registered components
	 */
	getDebugInfo(): {
		layers: Array<{
			name: string;
			focusOrder: string[];
			currentFocus: string | null;
		}>;
	} {
		return {
			layers: this.layerStack.map((layer) => ({
				name: layer.name,
				focusOrder: layer.focusOrder.map((token) => {
					const reg = this.registrations.get(token);
					return reg ? reg.name : "unknown";
				}),
				currentFocus: layer.currentFocus
					? this.registrations.get(layer.currentFocus)?.name || null
					: null,
			})),
		};
	}

	destroy(): void {
		// Deactivate current focus
		this.blur();

		// Clean up all registrations
		for (const registration of this.registrations.values()) {
			registration.component.destroy();
		}

		this.registrations.clear();
		this.layerStack = [];

		// Remove keyboard listener
		this.scene.input.keyboard?.off("keydown", this.keydownListener);

		// Clean up event emitter
		this.removeAllListeners();
	}
}
