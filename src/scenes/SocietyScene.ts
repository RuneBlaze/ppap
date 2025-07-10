import Phaser from "phaser";
import { BaseScene, InputMode } from "./BaseScene";
import { Palette } from "@/palette";
import { Grid, type Region } from "../grid/Grid";
import { Pawn } from "./Pawn";

export class SocietyScene extends BaseScene {
  private grid!: Grid;
  private graphics!: Phaser.GameObjects.Graphics;
  private cameraSpeed: number = 2; // Smoother movement
  private keys!: {
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
  };
  private pawns: Pawn[] = [];

  constructor() {
    super("SocietyScene");
  }

  protected preloadSceneAssets(): void {
    // Load portrait asset for pawns
    if (!this.textures.exists("portrait")) {
      this.load.image("portrait", "src/assets/portrait.png");
    }
  }

  protected createScene(): void {
    this.inputMode = InputMode.WORLD;
    this.grid = new Grid(24);
    this.setupKeyboard();
    this.createGridVisuals();
    this.initializeTestRegions();
    this.createPawns();
  }

  private setupKeyboard(): void {
    // TODO: Consolidate control schemes - currently using both WASD and arrow keys
    // This should be unified with other scenes' control schemes in the future
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        UP: Phaser.Input.Keyboard.KeyCodes.UP,
        DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      }) as any;
    }
  }

  private createGridVisuals(): void {
    this.graphics = this.add.graphics();
    this.drawGridAndRegions();
  }

  private initializeTestRegions(): void {
    // Create some test active regions for demonstration
    const testRegions = [
      // Region 1: Small L-shape
      [[0, 0], [24, 0], [0, 24], [0, 48]],
      // Region 2: Rectangle
      [[120, 48], [144, 48], [168, 48], [120, 72], [144, 72], [168, 72]],
      // Region 3: Single cell
      [[240, 120]]
    ];

    testRegions.forEach(region => {
      region.forEach(([x, y]) => {
        this.grid.addCell(x, y);
      });
    });

    this.grid.updateRegions();
    this.drawGridAndRegions(); // Redraw after updating regions
  }

  private createPawns(): void {
    // Create several pawns at different positions
    const pawnPositions = [
      { x: 0, y: 0, frame: 0 },
      { x: 24, y: 0, frame: 0 },
      { x: 120, y: 48, frame: 0 },
      { x: 144, y: 48, frame: 0 },
      { x: 240, y: 120, frame: 0 }
    ];

    pawnPositions.forEach(pos => {
      const pawn = new Pawn(this, pos.x, pos.y, this.grid, pos.frame);
      
      // Set up occupancy checker so pawns don't stack
      pawn.setOccupancyChecker((x, y, excludePawn) => {
        return this.pawns.some(p => {
          if (p === excludePawn) return false;
          const pawnPos = p.getGridPosition();
          return pawnPos.x === x && pawnPos.y === y;
        });
      });
      
      this.pawns.push(pawn);
    });
  }

  private drawGridAndRegions(): void {
    this.graphics.clear();
    const gridSize = this.grid.getGridSize();

    // Draw a large grid that extends beyond the viewport
    const gridExtent = 2000; // Large enough grid area

    // Set line style for faded non-active grid lines
    this.graphics.lineStyle(1, Palette.GRAY.num, 0.2);

    // Draw non-active grid lines (sparse, faded)
    for (let x = -gridExtent; x <= gridExtent; x += gridSize) {
      this.drawSparseDottedLine(x, -gridExtent, x, gridExtent, true);
    }

    for (let y = -gridExtent; y <= gridExtent; y += gridSize) {
      this.drawSparseDottedLine(-gridExtent, y, gridExtent, y, false);
    }

    // Draw regions
    this.drawRegions();
  }

  private drawSparseDottedLine(x1: number, y1: number, x2: number, y2: number, isVertical: boolean): void {
    const dotLength = 1;
    const gapLength = 4; // Much sparser than active regions
    const segmentLength = dotLength + gapLength;

    if (isVertical) {
      const totalLength = Math.abs(y2 - y1);
      const segments = Math.floor(totalLength / segmentLength);

      for (let i = 0; i < segments; i++) {
        const segmentY = y1 + i * segmentLength;
        this.graphics.beginPath();
        this.graphics.moveTo(x1, segmentY);
        this.graphics.lineTo(x1, segmentY + dotLength);
        this.graphics.strokePath();
      }
    } else {
      const totalLength = Math.abs(x2 - x1);
      const segments = Math.floor(totalLength / segmentLength);

      for (let i = 0; i < segments; i++) {
        const segmentX = x1 + i * segmentLength;
        this.graphics.beginPath();
        this.graphics.moveTo(segmentX, y1);
        this.graphics.lineTo(segmentX + dotLength, y1);
        this.graphics.strokePath();
      }
    }
  }

  private drawRegions(): void {
    this.graphics.fillStyle(Palette.BLUE.num, 0.1);
    this.graphics.lineStyle(2, Palette.BLUE.num, 0.6);
    const gridSize = this.grid.getGridSize();

    for (const region of this.grid.getRegions()) {
      // Draw simple rectangle for each region
      const { minX, maxX, minY, maxY } = region.bounds;
      const width = maxX - minX + gridSize;
      const height = maxY - minY + gridSize;

      this.graphics.fillRect(minX, minY, width, height);
      this.graphics.strokeRect(minX, minY, width, height);

      // Draw active grid lines within the region
      this.drawActiveGridLines(region);
    }
  }


  private drawActiveGridLines(region: Region): void {
    const { minX, maxX, minY, maxY } = region.bounds;
    const gridSize = this.grid.getGridSize();

    // Set line style for active region grid lines
    this.graphics.lineStyle(1, Palette.BLUE.num, 0.8);

    // Draw vertical lines
    for (let x = minX; x <= maxX + gridSize; x += gridSize) {
      this.drawDottedLine(x, minY, x, maxY + gridSize, true, this.graphics);
    }

    // Draw horizontal lines
    for (let y = minY; y <= maxY + gridSize; y += gridSize) {
      this.drawDottedLine(minX, y, maxX + gridSize, y, false, this.graphics);
    }
  }

  private drawDottedLine(x1: number, y1: number, x2: number, y2: number, isVertical: boolean, graphics: Phaser.GameObjects.Graphics): void {
    const dotLength = 2;
    const gapLength = 1;
    const segmentLength = dotLength + gapLength;

    if (isVertical) {
      const totalLength = Math.abs(y2 - y1);
      const segments = Math.floor(totalLength / segmentLength);

      for (let i = 0; i < segments; i++) {
        const segmentY = y1 + i * segmentLength;
        graphics.beginPath();
        graphics.moveTo(x1, segmentY);
        graphics.lineTo(x1, segmentY + dotLength);
        graphics.strokePath();
      }
    } else {
      const totalLength = Math.abs(x2 - x1);
      const segments = Math.floor(totalLength / segmentLength);

      for (let i = 0; i < segments; i++) {
        const segmentX = x1 + i * segmentLength;
        graphics.beginPath();
        graphics.moveTo(segmentX, y1);
        graphics.lineTo(segmentX + dotLength, y1);
        graphics.strokePath();
      }
    }
  }

  update(time: number, delta: number): void {
    this.handleCameraMovement();
    
    // Update all pawns
    this.pawns.forEach(pawn => {
      pawn.update(time, delta);
    });
  }

  destroy(): void {
    // Clean up pawns
    this.pawns.forEach(pawn => {
      pawn.destroy();
    });
    this.pawns = [];
  }

  private handleCameraMovement(): void {
    // TODO: Integrate with unified control scheme system
    // Currently using basic WASD + arrow key movement
    if (!this.keys) return;

    const camera = this.cameras.main;
    let moveX = 0;
    let moveY = 0;

    // Check movement keys (both WASD and arrow keys)
    if (this.keys.UP.isDown) {
      moveY = -this.cameraSpeed;
    } else if (this.keys.DOWN.isDown) {
      moveY = this.cameraSpeed;
    }

    if (this.keys.LEFT.isDown) {
      moveX = -this.cameraSpeed;
    } else if (this.keys.RIGHT.isDown) {
      moveX = this.cameraSpeed;
    }

    // Apply camera movement - grid will automatically move with camera
    if (moveX !== 0 || moveY !== 0) {
      camera.scrollX += moveX;
      camera.scrollY += moveY;
    }
  }
}
