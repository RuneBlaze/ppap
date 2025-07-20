import animPredefs from "../assets/data/anims.toml";
import { BattleSprite } from "../base/BattleSprite";
import type { Anim } from "../base/ps";
import { Palette } from "../palette";
import { List, type ListItem } from "../ui/components/List";
import { Popup, type PopupInner } from "../ui/primitives/Popup";
import { TextBlock } from "../ui/primitives/TextBlock";
import { GenericFocusStateMachine } from "../ui/state/GenericFocusStateMachine";
import {
	type AnimationDemoFocusEvent,
	type AnimationDemoFocusState,
	animationDemoFocusConfig,
} from "./AnimationDemoFocusConfig";
import { BaseScene } from "./BaseScene";

export class AnimationDemoScene extends BaseScene {
	private animationList: List | null = null;
	private popupList: List | null = null;
	private animationFocusManager!: GenericFocusStateMachine<
		AnimationDemoFocusState,
		AnimationDemoFocusEvent
	>;

	private availableAnimations: string[] = [];
	private currentAnimation: string | null = null;
	private animationTitle: TextBlock | null = null;
	private enemySprite: BattleSprite | null = null;
	private currentAnim: Anim | null = null;

	// Timeline visualisation

	constructor() {
		super("AnimationDemoScene");
	}

	protected preloadSceneAssets() {
		// Assets are now preloaded in BootScene
	}

	protected createScene() {
		this.createBackground();
		this.extractAvailableAnimations();
		this.createAnimationList();
		this.createPopupList();
		this.initializeFocusManager();
		this.createTitle();
		this.createInstructions();
		this.createEnemySprite();
	}

	private createBackground() {
		const graphics = this.add.graphics();
		graphics.fillStyle(Palette.BLACK.num);
		graphics.fillRect(0, 0, 427, 240);
	}

	private extractAvailableAnimations() {
		const anims = animPredefs.anims as Record<string, any>;
		this.availableAnimations = Object.keys(anims).sort();
	}

	private createTitle() {
		new TextBlock(this, {
			x: 20,
			y: 20,
			text: "Animation Demo",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});

		this.animationTitle = new TextBlock(this, {
			x: 20,
			y: 40,
			text: "Select an animation to preview",
			fontKey: "everydayStandard",
			color: Palette.YELLOW.hex,
		});
	}

	private createInstructions() {
		new TextBlock(this, {
			x: 20,
			y: 200,
			text: "SPACE: Animations, P: Popup Demo, ESC: Close menus",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});

		new TextBlock(this, {
			x: 20,
			y: 220,
			text: "HD-2D: Sprite illumination and flash effects are now primed!",
			fontKey: "everydayStandard",
			color: Palette.YELLOW.hex,
		});
	}

	private initializeFocusManager() {
		this.animationFocusManager = new GenericFocusStateMachine(
			this,
			animationDemoFocusConfig,
		);

		if (this.animationList) {
			this.animationFocusManager.registerComponent(
				"animationMenu",
				this.animationList,
				() => this.showList(this.animationList),
				() => this.hideList(this.animationList),
			);
		}
		if (this.popupList) {
			this.animationFocusManager.registerComponent(
				"popupMenu",
				this.popupList,
				() => this.showList(this.popupList),
				() => this.hideList(this.popupList),
			);
		}

		this.input.keyboard?.on("keydown-SPACE", () => {
			this.animationFocusManager.sendEvent({ type: "toggleAnimationMenu" });
		});
		this.input.keyboard?.on("keydown-P", () => {
			this.animationFocusManager.sendEvent({ type: "togglePopupMenu" });
		});
		this.input.keyboard?.on("keydown-ESC", () => {
			this.animationFocusManager.sendEvent({ type: "close" });
		});
	}

	private createAnimationList() {
		const animationItems: (ListItem & { onSelect: () => void })[] =
			this.availableAnimations.map((animName) => ({
				text: animName,
				onSelect: () => {
					this.playAnimation(animName);
					this.animationFocusManager.sendEvent({ type: "selectItem" });
				},
			}));

		animationItems.push({
			text: "Close Menu",
			onSelect: () => this.animationFocusManager.sendEvent({ type: "close" }),
		});

		this.animationList = new List(this, {
			x: 240,
			y: 60,
			width: 160,
			items: animationItems,
			onSelect: (_item, index) => {
				animationItems[index].onSelect();
			},
			onCancel: () => this.animationFocusManager.sendEvent({ type: "close" }),
		});

		this.animationList.setVisible(false);
		this.animationList.deactivate();
	}

	private createPopupList() {
		const popupItems: (ListItem & { onSelect: () => void })[] = [
			{
				text: "HP Damage Critical",
				onSelect: () =>
					this.showPopupDemo({
						type: "HpChange",
						delta: -45,
						isCritical: true,
					}),
			},
			{
				text: "HP Heal",
				onSelect: () =>
					this.showPopupDemo({
						type: "HpChange",
						delta: 25,
						isCritical: false,
					}),
			},
			{
				text: "MP Drain",
				onSelect: () =>
					this.showPopupDemo({
						type: "MpChange",
						delta: -15,
						isCritical: false,
					}),
			},
			{
				text: "MP Restore Critical",
				onSelect: () =>
					this.showPopupDemo({
						type: "MpChange",
						delta: 30,
						isCritical: true,
					}),
			},
			{
				text: "Status Added (Poison)",
				onSelect: () =>
					this.showPopupDemo({
						type: "StatusChange",
						addOrRemove: 1,
						iconIndex: 32,
					}),
			},
			{
				text: "Status Removed (Shield)",
				onSelect: () =>
					this.showPopupDemo({
						type: "StatusChange",
						addOrRemove: 0,
						iconIndex: 48,
					}),
			},
			{
				text: "Generic Message",
				onSelect: () =>
					this.showPopupDemo({ type: "Generic", text: "LEVEL UP!" }),
			},
			{
				text: "Close Menu",
				onSelect: () => this.animationFocusManager.sendEvent({ type: "close" }),
			},
		];

		this.popupList = new List(this, {
			x: 20,
			y: 60,
			width: 180,
			items: popupItems,
			onSelect: (_item, index) => {
				const selected = popupItems[index];
				selected.onSelect();
				if (selected.text !== "Close Menu") {
					this.animationFocusManager.sendEvent({ type: "selectItem" });
				}
			},
			onCancel: () => this.animationFocusManager.sendEvent({ type: "close" }),
		});

		this.popupList.setVisible(false);
		this.popupList.deactivate();
	}

	private showList(list: List | null) {
		if (!list) return;
		const window = list.getWindow();
		if (window) {
			window.fadeIn({ duration: 200 });
		}
		list.setVisible(true);
	}

	private hideList(list: List | null) {
		if (!list) return;
		const window = list.getWindow();
		if (window) {
			// Let fadeOut handle making it invisible
			window.fadeOut({ duration: 200 });
		} else {
			list.setVisible(false);
		}
	}

	private showPopupDemo(inner: PopupInner) {
		if (!this.enemySprite) return;

		const x = this.enemySprite.x + (Math.random() - 0.5) * 40;
		const y = this.enemySprite.y - 30 + (Math.random() - 0.5) * 20;

		new Popup(this, x, y, inner);
	}

	private createEnemySprite() {
		const centerX = 213;
		const centerY = 120;
		this.enemySprite = new BattleSprite(this, centerX, centerY, "enemies", 2);
	}

	private playAnimation(animName: string) {
		this.currentAnimation = animName;

		if (this.animationTitle) {
			this.animationTitle.setText(`Playing: ${animName} (looping)`);
		}

		const centerX = 213;
		const centerY = 120;

		// Stop any current animation
		if (this.currentAnim) {
			this.currentAnim.dead = true;
		}

		// Start the new predefined animation at the sprite's position with looping
		this.startLoopingAnimation(animName, centerX, centerY);
	}

	private startLoopingAnimation(animName: string, x: number, y: number) {
		const playNextIteration = () => {
			if (this.currentAnimation === animName) {
				// Only continue if this is still the current animation
				const newAnim = this.addPredefinedAnim(animName, x, y);
				if (newAnim && this.enemySprite) {
					this.currentAnim = newAnim;
				} else {
					console.warn(`Failed to create animation: ${animName}`);
				}
			}
		};

		playNextIteration();
	}

	private createInstructionText() {
		new TextBlock(this, {
			x: 20,
			y: 60,
			text: "Press SPACE for animations, P for popup demo",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});
	}

	async create() {
		await super.create();
		this.createInstructionText();
	}

	// Override update to handle animation looping
	update(time: number, delta: number): void {
		super.update(time, delta);

		// Check if current animation is dead and restart it for looping
		if (this.currentAnim?.dead && this.currentAnimation) {
			const centerX = 213;
			const centerY = 120;
			this.startLoopingAnimation(this.currentAnimation, centerX, centerY);
		}
	}

	destroy() {
		if (this.animationFocusManager) {
			this.animationFocusManager.destroy();
		}
	}
}
