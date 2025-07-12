import Phaser from "phaser";
import { DrawUtils } from "../../draw-utils";
import { getFontStyle } from "../../fonts";

// PopupInner type definition
export type PopupInner =
	| { type: "HpChange"; delta: number; isCritical: boolean }
	| { type: "MpChange"; delta: number; isCritical: boolean }
	| { type: "StatusChange"; addOrRemove: 0 | 1; iconIndex: number }
	| { type: "Generic"; text: string };

export class Popup extends Phaser.GameObjects.Text {
	private lifetime: number;
	private readonly initialLifetime: number;

	private currentYVelocity: number;
	private readonly yAcceleration: number;
	private readonly xVelocity: number;
	private icon?: Phaser.GameObjects.Image;

	constructor(scene: Phaser.Scene, x: number, y: number, inner: PopupInner) {
		const { text, style, isCritical, iconIndex } = Popup.processInner(inner);

		super(scene, x, y, text, style);
		this.setOrigin(0.5, 0.5);

		// Physics constants based on whether the popup is critical
		if (isCritical) {
			this.initialLifetime = 90; // Corresponds to 1500ms at 60fps
			this.yAcceleration = 0.0395;
			this.currentYVelocity = -1.778;
		} else {
			this.initialLifetime = 60; // Corresponds to 1000ms at 60fps
			this.yAcceleration = 0.0556;
			this.currentYVelocity = -1.667;
		}
		this.lifetime = this.initialLifetime;

		this.xVelocity = (Math.random() - 0.5) * 1;

		scene.add.existing(this);
		this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);

		// Add icon if specified
		if (iconIndex !== undefined) {
			this.icon = DrawUtils.drawIcon(scene, x, y, iconIndex);
			// This will be positioned correctly in the update loop
		}

		if (isCritical) {
			this.scene.tweens.add({
				targets: this,
				scale: { from: 1, to: 1.6 },
				duration: 150,
				yoyo: true,
				ease: "Sine.easeInOut",
			});

			const flashColor =
				inner.type === "HpChange" && inner.delta >= 0 ? 0xeeffee : 0xffffee;
			this.scene.tweens.add({
				targets: this,
				tint: flashColor,
				duration: 75,
				yoyo: true,
				repeat: 3,
			});
		}
	}

	update(_time: number, delta: number) {
		const deltaFactor = delta / 16.66;
		this.lifetime -= deltaFactor;

		if (this.lifetime <= 0) {
			this.destroy();
			return;
		}

		this.currentYVelocity += this.yAcceleration * deltaFactor;
		this.y = Math.round(this.y + this.currentYVelocity * deltaFactor);
		this.x = Math.round(this.x + this.xVelocity * deltaFactor);

		// Update icon position if it exists
		if (this.icon) {
			this.icon.y = this.y;
			// Position icon to the left of the text, adjusting for text width
			this.icon.x = Math.round(
				this.x - (this.width * this.scaleX) / 2 - this.icon.width / 2,
			);
		}

		if (this.lifetime < this.initialLifetime / 2) {
			const alpha = Phaser.Math.Clamp(
				this.lifetime / (this.initialLifetime / 2),
				0,
				1,
			);
			this.alpha = alpha;
			if (this.icon) {
				this.icon.alpha = alpha;
			}
		}
	}

	destroy(fromScene?: boolean) {
		this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
		if (this.icon) {
			this.icon.destroy();
		}
		super.destroy(fromScene);
	}

	static processInner(inner: PopupInner): {
		text: string;
		style: Phaser.Types.GameObjects.Text.TextStyle;
		isCritical: boolean;
		iconIndex?: number;
	} {
		let text: string;
		let color: string;
		let isCritical: boolean;
		let iconIndex: number | undefined;

		switch (inner.type) {
			case "HpChange": {
				const isHealing = inner.delta >= 0;
				text = `${isHealing ? "" : ""}${Math.abs(inner.delta)}`;
				color = isHealing ? "#90ee90" : "#ff6347"; // LightGreen for heal, Tomato for damage
				isCritical = inner.isCritical;
				break;
			}

			case "MpChange": {
				const isMpGain = inner.delta >= 0;
				text = `${isMpGain ? "" : ""}${Math.abs(inner.delta)}`;
				color = isMpGain ? "#87ceeb" : "#4169e1"; // SkyBlue for gain, RoyalBlue for loss
				isCritical = inner.isCritical;
				break;
			}

			case "StatusChange":
				text = inner.addOrRemove === 1 ? "+" : "-";
				color = inner.addOrRemove === 1 ? "#90ee90" : "#ff6347";
				isCritical = false;
				iconIndex = inner.iconIndex;
				break;

			case "Generic":
				text = inner.text;
				color = "#ffffff";
				isCritical = false;
				break;
		}

		const style = getFontStyle("capitalHill", isCritical ? 14 : 9);
		style.stroke = "#000000";
		style.strokeThickness = 4;
		style.color = color;

		return { text, style, isCritical, iconIndex };
	}
}
