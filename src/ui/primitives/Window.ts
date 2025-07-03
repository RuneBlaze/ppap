import { DrawUtils, type WindowSkinOptions } from '../../draw-utils';

/**
 * A basic Window primitive.
 * This class wraps the `drawWindowSkin` utility in a `Phaser.GameObjects.Graphics`
 * object, making it easy to use as a building block for other UI components.
 */
export class Window extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, private options: WindowSkinOptions) {
    super(scene);
    this.x = options.x;
    this.y = options.y;

    DrawUtils.drawWindowSkin(this, options);
  }

  redraw(newOptions: Partial<WindowSkinOptions>) {
    this.options = { ...this.options, ...newOptions };
    this.clear();
    DrawUtils.drawWindowSkin(this, this.options);
  }
} 