import Phaser from "phaser";
import type { IlluminationTarget } from "./ps";
import { BrightnessTintShader } from "./BrightnessTintShader";
import { Popup } from "../ui/primitives/Popup";

export class BattleSprite extends Phaser.GameObjects.Sprite implements IlluminationTarget {
  sprite: Phaser.GameObjects.Sprite; // Required by IlluminationTarget interface
  baseIntensity: number = 1.0;
  currentIntensity: number = 1.0;
  
  // HD-2D properties
  private flashTween?: Phaser.Tweens.Tween;
  private tintShader?: BrightnessTintShader;
  
  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame);
    
    this.sprite = this; // Self-reference for IlluminationTarget interface
    
    // Ensure shader is registered
    BrightnessTintShader.registerShader(scene.game);
    
    // Apply the brightness tint shader
    try {
      this.setPostPipeline('BrightnessTint');
      this.tintShader = this.getPostPipeline('BrightnessTint') as BrightnessTintShader;
    } catch (err) {
      console.warn("Failed to apply BrightnessTint shader:", err);
    }
    
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
  
  triggerFlash(intensity: number = 1.0, duration: number = 40): void {
    if (this.flashTween) {
      this.flashTween.stop();
    }
    
    if (this.tintShader) {
      // Set full white tint for flash
      this.tintShader.tintIntensity = intensity;
      this.tintShader.tintColor = [1.0, 1.0, 1.0];
      
      // Tween the shader intensity back to 0
      this.flashTween = this.scene.tweens.add({
        targets: this.tintShader,
        duration: duration,
        tintIntensity: 0,
        ease: 'Power2.easeOut',
        onComplete: () => {
          this.flashTween = undefined;
        }
      });
    }
  }
  
  public showPopup(delta: number, isCritical: boolean): void {
    new Popup(
      this.scene,
      this.x,
      this.y - this.height / 2, // appear above the sprite
      { type: "HpChange", delta, isCritical }
    );
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
    
    // Clean up shader
    if (this.tintShader) {
      this.resetPipeline();
    }
    
    super.destroy(fromScene);
  }
}