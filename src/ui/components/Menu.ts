import { Container } from "../layout/Container";
import { SelectionHighlight } from "../primitives/SelectionHighlight";
import { TextBlock } from "../primitives/TextBlock";
import { Window } from "../primitives/Window";
import { NavigationController } from "../state/NavigationController";

export interface MenuItem {
	text: string;
	onSelect: () => void;
}

export interface MenuOptions {
	x: number;
	y: number;
	width: number;
	items: MenuItem[];
	onCancel?: () => void;
}

const PADDING = 4;
const LINE_HEIGHT = 12;

/**
 * A classic JRPG-style menu.
 * It's a single window containing a list of text items.
 * Navigation is handled by a controller, and selection is shown with a highlight.
 * Font size is automatically determined by the fontKey to preserve pixel-perfect rendering.
 */
export class Menu extends Container {
	private nav: NavigationController;
	private textBlocks: TextBlock[] = [];
	private highlight: SelectionHighlight;
	private window: Window;

	constructor(
		scene: Phaser.Scene,
		private options: MenuOptions,
	) {
		super(scene, options.x, options.y);

		const menuHeight = options.items.length * LINE_HEIGHT + PADDING * 2;

		this.window = new Window(scene, {
			x: 0,
			y: 0,
			width: options.width,
			height: menuHeight,
		});
		this.add(this.window);

		this.highlight = new SelectionHighlight(scene);
		this.add(this.highlight);

		this.setItems(options.items);

		this.nav = new NavigationController(scene);
		this.nav.setItems(this.options.items.length);
		this.nav.on("changed", this.handleSelectionChange, this);
		this.nav.on("activated", this.handleActivation, this);
		if (options.onCancel) {
			this.nav.on("cancelled", options.onCancel, this);
		}

		// Set initial highlight only if items exist
		if (this.options.items.length > 0) {
			this.handleSelectionChange(0); 
		}
	}

	public getWindow(): Window {
		return this.window;
	}

	setItems(items: MenuItem[]) {
		// Clear existing items
		this.textBlocks.forEach(tb => tb.destroy());
		this.textBlocks = [];
		this.options.items = items;

		// Resize window if it exists (it's a child of this container)
		if (this.window) {
			const menuHeight = items.length * LINE_HEIGHT + PADDING * 2;
			this.window.resize(this.options.width, menuHeight);
		}

		// Create new text blocks
		items.forEach((item, index) => {
			const textBlock = new TextBlock(this.scene, {
				x: PADDING,
				y: PADDING + index * LINE_HEIGHT,
				text: item.text,
				fontKey: "everydayStandard",
			});
			this.add(textBlock);
			this.textBlocks.push(textBlock);
		});

		// Update navigation
		if (this.nav) {
			this.nav.setItems(items.length);
			if (items.length > 0) {
				this.handleSelectionChange(0);
			}
		}
	}

	activate() {
		this.nav.setActive(true);
		this.highlight.setVisible(true);
	}

	deactivate() {
		this.nav.setActive(false);
		this.highlight.setVisible(false);
	}

	private handleSelectionChange(index: number) {
		const target = this.textBlocks[index];
		if (target) {
			this.highlight.highlight(target);
		}
	}

	private handleActivation(index: number) {
		this.options.items[index].onSelect();
	}

	destroy(fromScene?: boolean) {
		this.nav.destroy();
		super.destroy(fromScene);
	}
}
