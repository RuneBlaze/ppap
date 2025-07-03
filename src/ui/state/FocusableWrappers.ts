/**
 * Wrapper classes that make existing UI components work with FocusManager
 * These adapt the current component APIs to the Focusable interface
 */

import type { Focusable } from './FocusManager';
import { List } from '../components/List';
import { Menu } from '../components/Menu';
import { GridNavigationController } from './GridNavigationController';

/**
 * Wrapper for List component
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

  // Expose the underlying list for direct access
  getList(): List {
    return this.list;
  }
}

/**
 * Wrapper for Menu component
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

  // Expose the underlying menu for direct access
  getMenu(): Menu {
    return this.menu;
  }
}

/**
 * Wrapper for GridNavigationController
 * Since GridNavigationController doesn't have activate/deactivate methods,
 * we'll use setActive instead
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

  // Expose the underlying grid for direct access
  getGrid(): GridNavigationController {
    return this.grid;
  }
}

/**
 * Generic wrapper for any component that has activate/deactivate methods
 */
export class FocusableComponent<T extends { activate(): void; deactivate(): void; destroy(): void }> implements Focusable {
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

  // Expose the underlying component for direct access
  getComponent(): T {
    return this.component;
  }
}