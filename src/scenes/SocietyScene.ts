import Phaser from "phaser";
import { Palette } from "@/palette";
import { Grid, type Region } from "../grid/Grid";
import { WorldState } from "@/state/WorldState";
import type { WorldStateData } from "@/state/types";
import { BaseScene } from "./BaseScene";
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
	private world!: WorldState;

	constructor() {
		super("SocietyScene");
	}

	protected preloadSceneAssets(): void {
		// Assets are now preloaded in BootScene
	}

	protected createScene(): void {
		this.grid = new Grid(24);
		this.setupKeyboard();
		this.createGridVisuals();
		this.initializeTestRegions();

		// Initialize world state with pawns from seed positions
		const initialPawns = {
			p1: { id: "p1", pos: { x: 0, y: 0 } },
			p2: { id: "p2", pos: { x: 24, y: 0 } },
			p3: { id: "p3", pos: { x: 120, y: 48 } },
			p4: { id: "p4", pos: { x: 144, y: 48 } },
			p5: { id: "p5", pos: { x: 240, y: 120 } },
		} as const;
		const stateData: WorldStateData = {
			pawns: { ...initialPawns },
			grid: this.grid,
		};
		this.world = new WorldState(stateData);

		this.createPawnsFromState();
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
			[
				[0, 0],
				[24, 0],
				[0, 24],
				[0, 48],
			],
			// Region 2: Rectangle
			[
				[120, 48],
				[144, 48],
				[168, 48],
				[120, 72],
				[144, 72],
				[168, 72],
			],
			// Region 3: Single cell
			[[240, 120]],
		];

		testRegions.forEach((region) => {
			region.forEach(([x, y]) => {
				this.grid.addCell(x, y);
			});
		});

		this.grid.updateRegions();
		this.drawGridAndRegions(); // Redraw after updating regions
	}

	private createPawnsFromState(): void {
		const gridSize = this.grid.getGridSize();
		const state = this.world.getState();
		this.pawns.forEach((p) => p.destroy());
		this.pawns = [];

		this.pawns = Object.values(state.pawns).map((pawnState) => {
			const pawn = new Pawn(this, {
				id: pawnState.id,
				intersectionX: pawnState.pos.x,
				intersectionY: pawnState.pos.y,
				gridSize,
				portraitFrame: 0,
			});

			pawn.on(
				"moveRequested",
				({ pawnId, to }: { pawnId: string; to: { x: number; y: number } }) => {
					const tx = WorldState.buildPawnMove(pawnId, { x: to.x, y: to.y });
					const result = this.world.commit(tx);
					if (result.success) {
						pawn.applyCommittedIntersection(to.x, to.y);
					} else {
						pawn.revertToCommitted();
					}
				},
			);

			return pawn;
		});
	}

	private drawGridAndRegions(): void {
		this.graphics.clear();
		const gridSize = this.grid.getGridSize();

		// Draw a large grid that extends beyond the viewport
		// Ensure gridExtent is divisible by gridSize to maintain alignment invariant
		const gridExtent = Math.ceil(2000 / gridSize) * gridSize; // Rounds up to nearest grid-aligned value

		// Set line style for faded non-active grid lines
		this.graphics.lineStyle(1, Palette.GRAY.num, 0.2);

		// Draw non-active grid lines (sparse, faded)
		for (let x = -gridExtent; x <= gridExtent; x += gridSize) {
			this.drawDottedLine(x, -gridExtent, x, gridExtent, true, 1, 4);
		}

		for (let y = -gridExtent; y <= gridExtent; y += gridSize) {
			this.drawDottedLine(-gridExtent, y, gridExtent, y, false, 1, 4);
		}

		// Draw regions
		this.drawRegions();
	}

	private drawRegions(): void {
		this.graphics.fillStyle(Palette.BLUE.num, 0.1);
		this.graphics.lineStyle(2, Palette.BLUE.num, 0.6);
		const gridSize = this.grid.getGridSize();

		for (const region of this.grid.getRegions()) {
			// Draw individual cells for each region using top-left intersection coordinates
			for (const cellKey of region.cells) {
				const [x, y] = cellKey.split(",").map(Number);
				this.graphics.fillRect(x, y, gridSize, gridSize);
				this.graphics.strokeRect(x, y, gridSize, gridSize);
			}

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
			this.drawDottedLine(x, minY, x, maxY + gridSize, true, 2, 3);
		}

		// Draw horizontal lines
		for (let y = minY; y <= maxY + gridSize; y += gridSize) {
			this.drawDottedLine(minX, y, maxX + gridSize, y, false, 2, 3);
		}
	}

	private drawDottedLine(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		isVertical: boolean,
		dotLength: number,
		gapLength: number,
	): void {
		const gridSize = this.grid.getGridSize();
		
		// Enforce grid alignment invariant: all coordinates must be divisible by gridSize
		if (x1 % gridSize !== 0) {
			throw new Error(`Grid alignment violation: x1=${x1} is not divisible by gridSize=${gridSize}`);
		}
		if (y1 % gridSize !== 0) {
			throw new Error(`Grid alignment violation: y1=${y1} is not divisible by gridSize=${gridSize}`);
		}
		if (x2 % gridSize !== 0) {
			throw new Error(`Grid alignment violation: x2=${x2} is not divisible by gridSize=${gridSize}`);
		}
		if (y2 % gridSize !== 0) {
			throw new Error(`Grid alignment violation: y2=${y2} is not divisible by gridSize=${gridSize}`);
		}
		
		const segmentLength = dotLength + gapLength;
		this.graphics.beginPath();
		
		if (isVertical) {
			// Start from the first grid intersection at or after y1
			const startIntersection = Math.ceil(y1 / gridSize) * gridSize;
			const endIntersection = Math.floor(y2 / gridSize) * gridSize;

			for (let y = startIntersection; y <= endIntersection; y += gridSize) {
				// Draw dots along this grid line, aligned to segment boundaries
				const localStart = 0; // Start from intersection
				const localEnd = gridSize; // Go to next intersection
				
				for (let localPos = localStart; localPos < localEnd; localPos += segmentLength) {
					const dotY = y + localPos;
					if (dotY >= y1 && dotY + dotLength <= y2) {
						this.graphics.moveTo(x1, dotY);
						this.graphics.lineTo(x1, dotY + dotLength);
					}
				}
			}
		} else {
			// horizontal - same logic but for X axis
			const startIntersection = Math.ceil(x1 / gridSize) * gridSize;
			const endIntersection = Math.floor(x2 / gridSize) * gridSize;

			for (let x = startIntersection; x <= endIntersection; x += gridSize) {
				const localStart = 0;
				const localEnd = gridSize;
				
				for (let localPos = localStart; localPos < localEnd; localPos += segmentLength) {
					const dotX = x + localPos;
					if (dotX >= x1 && dotX + dotLength <= x2) {
						this.graphics.moveTo(dotX, y1);
						this.graphics.lineTo(dotX + dotLength, y1);
					}
				}
			}
		}
		this.graphics.strokePath();
	}

	update(time: number, delta: number): void {
		this.handleCameraMovement();

		// Update all pawns
		this.pawns.forEach((pawn) => {
			pawn.update(time, delta);
		});
	}

	destroy(): void {
		// Clean up pawns
		this.pawns.forEach((pawn) => {
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
