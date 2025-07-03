import { DrawUtils, type WindowSkinOptions } from '../../draw-utils';

export interface WindowTransitionOptions {
  type?: 'fade' | 'none';
  duration?: number;
  onComplete?: () => void;
}

/**
 * A basic Window primitive.
 * This class wraps the `drawWindowSkin` utility in a `Phaser.GameObjects.Graphics`
 * object, making it easy to use as a building block for other UI components.
 */
export class Window extends Phaser.GameObjects.Graphics {
  private transitionTween?: Phaser.Tweens.Tween;
  private options: WindowSkinOptions & { transition?: WindowTransitionOptions };
  
  constructor(scene: Phaser.Scene, options: WindowSkinOptions & { transition?: WindowTransitionOptions }) {
    super(scene);
    this.options = options;
    this.x = options.x;
    this.y = options.y;

    DrawUtils.drawWindowSkin(this, this.options);
    
    scene.add.existing(this);
    
    // Handle initial transition
    if (options.transition?.type === 'fade') {
      this.handleFadeIn(options.transition);
    }
  }

  redraw(newOptions: Partial<WindowSkinOptions>) {
    this.options = { ...this.options, ...newOptions };
    this.clear();
    DrawUtils.drawWindowSkin(this, this.options);
  }

  private handleFadeIn(transition: WindowTransitionOptions) {
    const duration = transition.duration || 300;

    // Simple alpha fade
    this.setAlpha(0);
    this.transitionTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: duration,
      ease: 'Power2.easeOut',
      onComplete: transition.onComplete
    });
  }

  fadeOut(transition: WindowTransitionOptions = {}) {
    const duration = transition.duration || 300;

    // Simple alpha fade
    this.transitionTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: duration,
      ease: 'Power2.easeIn',
      onComplete: () => {
        this.setVisible(false);
        transition.onComplete?.();
      }
    });
  }

  destroy() {
    if (this.transitionTween) {
      this.transitionTween.destroy();
    }
    super.destroy();
  }
} 