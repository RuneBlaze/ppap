/**
 * Simplified Focusable Wrappers for FSM-based Focus Management
 * 
 * These are much simpler than the original wrappers since we don't need
 * complex token management or registration logic.
 */

import type { List } from "../components/List";
import type { Menu } from "../components/Menu";
import type { GridNavigationController } from "./GridNavigationController";

export interface Focusable {
	activate(): void;
	deactivate(): void;
	destroy(): void;
}

/**
 * Wrapper for Menu component with enhanced keyboard navigation
 */
export class FocusableMenu implements Focusable {
	private menu: Menu;

	constructor(menu: Menu) {
		this.menu = menu;
	}

	activate(): void {
		this.menu.activate();
	}

	deactivate(): void {
		this.menu.deactivate();
	}

	destroy(): void {
		this.menu.destroy();
	}

	// Enhanced navigation methods for FSM system
	focusNext(): void {
		if ("focusNext" in this.menu) {
			(this.menu as any).focusNext();
		}
	}

	focusPrevious(): void {
		if ("focusPrevious" in this.menu) {
			(this.menu as any).focusPrevious();
		}
	}

	handleEnter(): void {
		if ("handleEnter" in this.menu) {
			(this.menu as any).handleEnter();
		}
	}

	// Expose the underlying menu for direct access
	getMenu(): Menu {
		return this.menu;
	}
}

/**
 * Wrapper for List component with enhanced keyboard navigation
 */
export class FocusableList implements Focusable {
	private list: List;

	constructor(list: List) {
		this.list = list;
	}

	activate(): void {
		this.list.activate();
	}

	deactivate(): void {
		this.list.deactivate();
	}

	destroy(): void {
		this.list.destroy();
	}

	// Enhanced navigation methods for FSM system
	focusNext(): void {
		if ("focusNext" in this.list) {
			(this.list as any).focusNext();
		}
	}

	focusPrevious(): void {
		if ("focusPrevious" in this.list) {
			(this.list as any).focusPrevious();
		}
	}

	handleEnter(): void {
		if ("handleEnter" in this.list) {
			(this.list as any).handleEnter();
		}
	}

	// Expose the underlying list for direct access
	getList(): List {
		return this.list;
	}
}

/**
 * Wrapper for GridNavigationController with enhanced keyboard navigation
 */
export class FocusableGrid implements Focusable {
	private grid: GridNavigationController;

	constructor(grid: GridNavigationController) {
		this.grid = grid;
	}

	activate(): void {
		this.grid.setActive(true);
	}

	deactivate(): void {
		this.grid.setActive(false);
	}

	destroy(): void {
		this.grid.destroy();
	}

	// Enhanced navigation methods for FSM system
	focusNext(): void {
		if ("focusNext" in this.grid) {
			(this.grid as any).focusNext();
		}
	}

	focusPrevious(): void {
		if ("focusPrevious" in this.grid) {
			(this.grid as any).focusPrevious();
		}
	}

	handleEnter(): void {
		if ("handleEnter" in this.grid) {
			(this.grid as any).handleEnter();
		}
	}

	// Expose the underlying grid for direct access
	getGrid(): GridNavigationController {
		return this.grid;
	}
}

/**
 * Generic wrapper for any component with enhanced keyboard navigation
 */
export class FocusableComponent<
	T extends { activate(): void; deactivate(): void; destroy(): void },
> implements Focusable
{
	private component: T;

	constructor(component: T) {
		this.component = component;
	}

	activate(): void {
		this.component.activate();
	}

	deactivate(): void {
		this.component.deactivate();
	}

	destroy(): void {
		this.component.destroy();
	}

	// Enhanced navigation methods for FSM system
	focusNext(): void {
		if ("focusNext" in this.component) {
			(this.component as any).focusNext();
		}
	}

	focusPrevious(): void {
		if ("focusPrevious" in this.component) {
			(this.component as any).focusPrevious();
		}
	}

	handleEnter(): void {
		if ("handleEnter" in this.component) {
			(this.component as any).handleEnter();
		}
	}

	// Expose the underlying component for direct access
	getComponent(): T {
		return this.component;
	}
}