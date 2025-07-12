import Phaser from "phaser";
import { Palette } from "../palette";
import { Popup } from "../ui/primitives/Popup";
import type { IlluminationTarget } from "./ps";

export class BattleSprite
	extends Phaser.GameObjects.Sprite
	implements IlluminationTarget
{
	sprite: Phaser.GameObjects.Sprite; // Required by IlluminationTarget interface
	baseIntensity: number = 1.0;
	currentIntensity: number = 1.0;

	// HD-2D properties
	private flashTween?: Phaser.Tweens.Tween;

	constructor(
		scene: Phaser.Scene,
		x: number,
		y: number,
		texture: string,
		frame?: string | number,
	) {
		super(scene, x, y, texture, frame);

		this.sprite = this; // Self-reference for IlluminationTarget interface

		scene.add.existing(this);
	}

	updateIllumination(intensity: number): void {
		this.currentIntensity = this.baseIntensity + intensity;

		// if (this.tintShader) {
		//   // Use shader for smooth white brightening
		//   this.tintShader.tintIntensity = Math.min(intensity * 0.01, 1.0);
		//   this.tintShader.tintColor = [1.0, 1.0, 1.0]; // White tint for brightening
		// }
	}

	triggerFlash(_intensity: number = 1.0, duration: number = 40): void {
		if (this.flashTween) {
			this.flashTween.stop();
		}

		// Use simple tint effect as fallback for flash
		this.setTint(0xffffff);

		this.flashTween = this.scene.tweens.add({
			targets: this,
			duration: duration,
			alpha: 1,
			ease: "Power2.easeOut",
			onComplete: () => {
				this.clearTint();
				this.flashTween = undefined;
			},
		});
	}

	public showPopup(delta: number, isCritical: boolean): void {
		new Popup(
			this.scene,
			this.x,
			this.y - this.height / 2, // appear above the sprite
			{ type: "HpChange", delta, isCritical },
		);
	}

	public flash() {
		// Prevent crash if scene is gone (e.g., during scene transition)
		if (!this.scene) {
			return;
		}

		this.setTint(Palette.WHITE.num);
		this.scene.tweens.add({
			targets: this,
			alpha: { from: 0.5, to: 1 },
			duration: 150,
			yoyo: true,
			onComplete: () => {
				this.clearTint();
			},
		});
	}

	// HD-2D animation support
	playHitAnimation(hitCount: number = 1): void {
		const flashDelay = 80; // ms between flashes (shorter)

		for (let i = 0; i < hitCount; i++) {
			this.scene.time.delayedCall(i * flashDelay, () => {
				this.triggerFlash(0.8, 30); // Much shorter flash duration
			});
		}
	}

	destroy(fromScene?: boolean): void {
		if (this.flashTween) {
			this.flashTween.stop();
		}

		super.destroy(fromScene);
	}
}
