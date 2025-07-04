// TODO: Implement Cursor
// This will be a selection indicator with animations, as described in JRPG_UI_DESIGN.md.
// It will likely be a `Phaser.GameObjects.Sprite` with different animations
// for 'idle', 'confirm', etc. states.

/**
 * A movable cursor for UI navigation.
 * It's a `Phaser.GameObjects.Sprite` that can be tweened to new positions
 * to indicate the currently selected UI element.
 */
export class Cursor extends Phaser.GameObjects.Sprite {
	constructor(scene: Phaser.Scene, x: number, y: number) {
		super(scene, x, y, "cursor");
		scene.add.existing(this);
		this.setVisible(false);
	}

	/**
	 * Moves the cursor to a specific UI element's position.
	 * @param target The target game object to move to.
	 */
	moveTo(target: Phaser.GameObjects.GameObject) {
		if (!this.scene || !("getBounds" in target)) return;

		const targetWithBounds = target as Phaser.GameObjects.Container; // Or any object with bounds
		const targetBounds = targetWithBounds.getBounds();
		const targetPosition = {
			x: targetBounds.left - this.width, // Position to the left of the target
			y: targetBounds.centerY,
		};

		this.setVisible(true);
		this.scene.tweens.add({
			targets: this,
			x: targetPosition.x,
			y: targetPosition.y,
			duration: 100,
			ease: "Quad.easeOut",
		});
	}

	hide() {
		this.setVisible(false);
	}
}
