import { DrawUtils } from "../draw-utils";
import { Palette } from "../palette";
import { Menu, type MenuItem } from "../ui/components/Menu";
import { TextBlock } from "../ui/primitives/TextBlock";
import { Window } from "../ui/primitives/Window";
import { BaseScene } from "./BaseScene";
import animPredefs from "../assets/anims.toml";
import { Anim } from "../base/ps";

export class AnimationDemoScene extends BaseScene {
	private animationMenu: Menu | null = null;
	private availableAnimations: string[] = [];
	private currentAnimation: string | null = null;
	private animationTitle: TextBlock | null = null;
	private enemySprite: Phaser.GameObjects.Sprite | null = null;
	private currentAnim: Anim | null = null;

	constructor() {
		super("AnimationDemoScene");
	}

	protected preloadSceneAssets() {
		this.load.spritesheet("enemies", "src/assets/enemies.png", {
			frameWidth: 64,
			frameHeight: 64,
		});
	}

	protected createScene() {
		this.createBackground();
		this.extractAvailableAnimations();
		this.createAnimationMenu();
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
			text: "Use arrow keys to navigate, ENTER to select, ESC to close menu",
			fontKey: "everydayStandard",
			color: Palette.WHITE.hex,
		});
	}

	private createAnimationMenu() {
		const animationItems: MenuItem[] = this.availableAnimations.map((animName) => ({
			text: animName,
			onSelect: () => this.playAnimation(animName),
		}));

		animationItems.push({
			text: "Close Menu",
			onSelect: () => this.hideAnimationMenu(),
		});

		this.animationMenu = new Menu(this, {
			x: 240,
			y: 60,
			width: 160,
			items: animationItems,
		});

		this.animationMenu.setVisible(false);

		this.input.keyboard?.on("keydown-SPACE", () => {
			this.toggleAnimationMenu();
		});

		this.input.keyboard?.on("keydown-ESC", () => {
			this.hideAnimationMenu();
		});
	}

	private toggleAnimationMenu() {
		if (!this.animationMenu) return;

		if (this.animationMenu.visible) {
			this.hideAnimationMenu();
		} else {
			this.showAnimationMenu();
		}
	}

	private showAnimationMenu() {
		if (!this.animationMenu) return;

		const window = this.animationMenu.getWindow();
		window.fadeIn({ duration: 300 });
		this.animationMenu.setVisible(true);
	}

	private hideAnimationMenu() {
		if (!this.animationMenu) return;

		const window = this.animationMenu.getWindow();
		window.fadeOut({ duration: 300 });
		this.animationMenu.setVisible(false);
	}

	private createEnemySprite() {
		const centerX = 213;
		const centerY = 120;
		this.enemySprite = this.add.sprite(centerX, centerY, "enemies", 2);
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
		
		this.hideAnimationMenu();
	}

	private startLoopingAnimation(animName: string, x: number, y: number) {
		const playNextIteration = () => {
			if (this.currentAnimation === animName) { // Only continue if this is still the current animation
				const newAnim = this.addPredefinedAnim(animName, x, y);
				if (newAnim) {
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
			text: "Press SPACE to open animation menu",
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
		if (this.currentAnim && this.currentAnim.dead && this.currentAnimation) {
			const centerX = 213;
			const centerY = 120;
			this.startLoopingAnimation(this.currentAnimation, centerX, centerY);
		}
	}
}