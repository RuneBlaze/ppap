import { Palette } from "../../palette";

/**
 * A visual highlight for indicating selection in a menu.
 * It's a semi-transparent filled rectangle.
 */
export class SelectionHighlight extends Phaser.GameObjects.Graphics {
	constructor(scene: Phaser.Scene) {
		super(scene);
	}

	/**
	 * Moves and resizes the highlight to fit a target game object.
	 * @param target The target game object to highlight.
	 */
	highlight(target: Phaser.GameObjects.Text) {
		const padding = 1; // A little padding around the text

		this.clear();
		this.fillStyle(
			Phaser.Display.Color.HexStringToColor(Palette.GREEN).color,
			0.4,
		);
		this.fillRect(
			target.x - padding,
			target.y - padding,
			target.width + padding * 2,
			target.height + padding * 2,
		);
		this.setVisible(true);
	}

	hide() {
		this.setVisible(false);
	}
}
