import type { Grid } from "@/grid/Grid";

/**
 * Represents a point on the grid using discrete, integer coordinates.
 * This is the canonical representation for a pawn's location.
 */
export interface GridPoint {
	x: number;
	y: number;
}

/**
 * The pure data representation of a pawn's state.
 * It contains no logic, only data.
 */
export interface PawnState {
	readonly id: string;
	pos: GridPoint;
	// Other properties like health, status, etc., would go here.
}

// --- Transactions ---

/**
 * A request to move a pawn to a new grid position.
 * This is a "dumb" data object that describes the intention to move.
 */
export interface PawnMoveTransaction {
	type: "PAWN_MOVE";
	payload: {
		pawnId: string;
		to: GridPoint;
	};
}

/**
 * A union of all possible transactions that can be committed to the WorldState.
 * This will be expanded as more actions are added to the game.
 */
export type Transaction = PawnMoveTransaction;

/**
 * The result of a transaction commit.
 * Indicates whether the change was accepted or rejected.
 */
export interface CommitResult {
	success: boolean;
	reason?: string;
}

/**
 * Represents the entire logical state of the "world" or a scene.
 * It is a pure data object with no dependencies on Phaser.
 */
export interface WorldStateData {
	pawns: Record<string, PawnState>;
	grid: Grid; // Assuming Grid is also pure data or can be treated as such.
}
