import { DrawUtils, type WindowSkinOptions } from "../../draw-utils";

export interface WindowTransitionOptions {
	type?: "fade" | "none";
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

	constructor(
		scene: Phaser.Scene,
		options: WindowSkinOptions & { transition?: WindowTransitionOptions },
	) {
		super(scene);
		this.options = options;
		this.x = options.x;
		this.y = options.y;

		DrawUtils.drawWindowSkin(this, this.options);

		scene.add.existing(this);

		// Handle initial transition
		if (options.transition?.type === "fade") {
			this.handleFadeIn(options.transition);
		}
	}

	getWidth(): number {
		return this.options.width;
	}

	getHeight(): number {
		return this.options.height;
	}

	resize(width: number, height: number) {
		this.options.width = width;
		this.options.height = height;
		this.redraw({});
	}

	redraw(newOptions: Partial<WindowSkinOptions>) {
		this.options = { ...this.options, ...newOptions };
		this.clear();
		DrawUtils.drawWindowSkin(this, this.options);
	}

	private handleFadeIn(transition: WindowTransitionOptions) {
		this.setAlpha(0);
		this.fadeIn(transition);
	}

	fadeIn(transition: WindowTransitionOptions = {}) {
		if (this.transitionTween?.isPlaying()) {
			this.transitionTween.stop();
		}
		
		this.setVisible(true);
		
		const duration = transition.duration || 300;
		this.transitionTween = this.scene.tweens.add({
			targets: this,
			alpha: 1,
			duration,
			ease: "Power2.easeOut",
			onComplete: transition.onComplete,
		});
	}

	fadeOut(transition: WindowTransitionOptions = {}) {
		if (this.transitionTween?.isPlaying()) {
			this.transitionTween.stop();
		}

		const duration = transition.duration || 300;

		// Simple alpha fade
		this.transitionTween = this.scene.tweens.add({
			targets: this,
			alpha: 0,
			duration: duration,
			ease: "Power2.easeIn",
			onComplete: () => {
				this.setVisible(false);
				transition.onComplete?.();
			},
		});
	}

	destroy() {
		if (this.transitionTween) {
			this.transitionTween.destroy();
		}
		super.destroy();
	}
}
