/**
 * A simple layout container that extends Phaser.GameObjects.Container.
 * This will serve as the base for more complex layout managers like
 * Grid, Stack, etc.
 */
export class Container extends Phaser.GameObjects.Container {
	constructor(
		scene: Phaser.Scene,
		x?: number,
		y?: number,
		children?: Phaser.GameObjects.GameObject[],
	) {
		super(scene, x, y, children);
		scene.add.existing(this);
	}
}
