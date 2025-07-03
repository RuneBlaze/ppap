import Phaser from 'phaser';
import { loadFonts } from '../fonts';
import { Palette } from '../palette';
import cursorImg from '../assets/cursor.png';

export abstract class BaseScene extends Phaser.Scene {
  private cursorSprite?: Phaser.GameObjects.Image;

  constructor(key: string) {
    super(key);
  }

  preload() {
    this.load.image('cursor', cursorImg);
    this.preloadSceneAssets();
  }

  async create() {
    this.cameras.main.setBackgroundColor(Palette.BLACK);
    
    this.setupCursor();
    
    await loadFonts();
    
    this.createScene();
  }

  private setupCursor(): void {
    this.input.setDefaultCursor('none');
    this.createCursorSprite();
  }

  private createCursorSprite(): void {
    this.cursorSprite = this.add.image(0, 0, 'cursor');
    this.cursorSprite.setOrigin(0, 0);
    this.cursorSprite.setDepth(10000);
    
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.cursorSprite) {
        const camera = this.cameras.main;
        this.cursorSprite.x = camera.scrollX + pointer.x / camera.zoom;
        this.cursorSprite.y = camera.scrollY + pointer.y / camera.zoom;
      }
    });
  }

  protected abstract preloadSceneAssets(): void;
  protected abstract createScene(): void;
}