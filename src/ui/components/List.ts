import { Container } from "../layout/Container";
import { SelectionHighlight } from "../primitives/SelectionHighlight";
import { TextBlock } from "../primitives/TextBlock";
import { Window } from "../primitives/Window";
import { NavigationController } from "../state/NavigationController";

export interface ListItem {
	text: string;
	value?: any;
	disabled?: boolean;
}

export interface ListOptions {
	x: number;
	y: number;
	width: number;
	height?: number;
	items: ListItem[];
	onSelect?: (item: ListItem, index: number) => void;
	onCancel?: () => void;
	showWindow?: boolean;
	maxVisibleItems?: number;
}

const PADDING = 4;
const LINE_HEIGHT = 12;

/**
 * A scrollable list component with keyboard navigation.
 * Similar to Menu but supports scrolling, disabled items, and more flexible configuration.
 */
export class List extends Container {
	private nav: NavigationController;
	private textBlocks: TextBlock[] = [];
	private highlight: SelectionHighlight;
	private scrollOffset = 0;
	private maxVisibleItems: number;
	private window?: Window;
	private options: ListOptions;

	constructor(scene: Phaser.Scene, options: ListOptions) {
		super(scene, options.x, options.y);
		this.options = options;

		// Calculate dimensions
		this.maxVisibleItems =
			options.maxVisibleItems ||
			Math.floor((options.height || 200) / LINE_HEIGHT) - 1;

		const actualHeight =
			options.height ||
			Math.min(options.items.length, this.maxVisibleItems) * LINE_HEIGHT +
				PADDING * 2;

		// Create window if requested
		if (options.showWindow !== false) {
			this.window = new Window(scene, {
				x: 0,
				y: 0,
				width: options.width,
				height: actualHeight,
			});
			this.add(this.window);
		}

		// Create highlight
		this.highlight = new SelectionHighlight(scene);
		this.add(this.highlight);

		// Create navigation controller
		this.nav = new NavigationController(scene);
		this.setupNavigation();

		// Initial render
		this.updateDisplay();
	}

	private setupNavigation() {
		// Only count non-disabled items for navigation
		const enabledItems = this.options.items.filter((item) => !item.disabled);
		this.nav.setItems(enabledItems.length);

		this.nav.on("changed", this.handleSelectionChange, this);
		this.nav.on("activated", this.handleActivation, this);
		if (this.options.onCancel) {
			this.nav.on("cancelled", this.options.onCancel, this);
		}

		// Set initial highlight
		this.handleSelectionChange(0);
	}

	private updateDisplay() {
		// Clear existing text blocks
		this.textBlocks.forEach((block) => block.destroy());
		this.textBlocks = [];

		// Calculate visible range
		const startIndex = this.scrollOffset;
		const endIndex = Math.min(
			startIndex + this.maxVisibleItems,
			this.options.items.length,
		);

		// Create text blocks for visible items
		for (let i = startIndex; i < endIndex; i++) {
			const item = this.options.items[i];
			const textBlock = new TextBlock(this.scene, {
				x: PADDING,
				y: PADDING + (i - startIndex) * LINE_HEIGHT,
				text: item.text,
				fontKey: "everydayStandard",
			});

			// Set alpha for disabled items
			if (item.disabled) {
				textBlock.setAlpha(0.5);
			}

			this.add(textBlock);
			this.textBlocks.push(textBlock);
		}
	}

	private handleSelectionChange(enabledIndex: number) {
		// Convert enabled index to actual item index
		const actualIndex = this.getActualIndex(enabledIndex);

		// Update scroll if needed
		if (actualIndex < this.scrollOffset) {
			this.scrollOffset = actualIndex;
			this.updateDisplay();
		} else if (actualIndex >= this.scrollOffset + this.maxVisibleItems) {
			this.scrollOffset = actualIndex - this.maxVisibleItems + 1;
			this.updateDisplay();
		}

		// Highlight the visible item
		const visibleIndex = actualIndex - this.scrollOffset;
		if (visibleIndex >= 0 && visibleIndex < this.textBlocks.length) {
			const target = this.textBlocks[visibleIndex];
			this.highlight.highlight(target);
		}
	}

	private handleActivation(enabledIndex: number) {
		const actualIndex = this.getActualIndex(enabledIndex);
		const item = this.options.items[actualIndex];

		if (item && !item.disabled && this.options.onSelect) {
			this.options.onSelect(item, actualIndex);
		}
	}

	private getActualIndex(enabledIndex: number): number {
		let enabledCount = 0;
		for (let i = 0; i < this.options.items.length; i++) {
			if (!this.options.items[i].disabled) {
				if (enabledCount === enabledIndex) {
					return i;
				}
				enabledCount++;
			}
		}
		return 0;
	}

	public setItems(items: ListItem[]) {
		this.options.items = items;
		this.scrollOffset = 0;

		// Update navigation
		const enabledItems = items.filter((item) => !item.disabled);
		this.nav.setItems(enabledItems.length);

		this.updateDisplay();
		this.handleSelectionChange(0);
	}

	public activate() {
		this.nav.setActive(true);
		this.highlight.setVisible(true);
	}

	public deactivate() {
		this.nav.setActive(false);
		this.highlight.setVisible(false);
	}

	public getCurrentIndex(): number {
		return this.nav.currentIndex; // Access private property
	}

	public setCurrentIndex(enabledIndex: number) {
		this.nav.currentIndex = enabledIndex;
		this.handleSelectionChange(enabledIndex);
	}

	public getWindow(): Window | undefined {
		return this.window;
	}

	destroy(fromScene?: boolean) {
		this.nav.destroy();
		super.destroy(fromScene);
	}
}
