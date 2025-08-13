import type {
	CommitResult,
	GridPoint,
	PawnMoveTransaction,
	Transaction,
	WorldStateData,
} from "./types";

export class WorldState {
    private currentState: WorldStateData;

    constructor(initialState: WorldStateData) {
        this.currentState = initialState;
    }

    public getState(): Readonly<WorldStateData> {
        return this.currentState;
    }

    public commit(transaction: Transaction): CommitResult {
        switch (transaction.type) {
            case "PAWN_MOVE": {
                return this.commitPawnMove(transaction.payload);
            }
            default:
                return { success: false, reason: "Unknown transaction type" };
        }
    }

    private commitPawnMove(payload: PawnMoveTransaction["payload"]): CommitResult {
        const { pawnId, to } = payload;
        const pawn = this.currentState.pawns[pawnId];
        if (!pawn) return { success: false, reason: `Pawn '${pawnId}' not found` };

        // Validate: target must be an active grid cell (intersection coords)
        const cellKey = `${to.x},${to.y}`;
        const isActive = this.currentState.grid.getActiveCells().has(cellKey);
        if (!isActive) return { success: false, reason: "Target cell is not active" };

        // Validate: no other pawn occupies the target cell
        for (const otherId in this.currentState.pawns) {
            if (otherId === pawnId) continue;
            const other = this.currentState.pawns[otherId];
            if (other.pos.x === to.x && other.pos.y === to.y) {
                return { success: false, reason: "Target cell is occupied" };
            }
        }

        // Apply
        pawn.pos = { x: to.x, y: to.y };
        return { success: true };
    }

	// --- Transaction Builders ---

	public static buildPawnMove(pawnId: string, to: GridPoint): PawnMoveTransaction {
		return {
			type: "PAWN_MOVE",
			payload: {
				pawnId,
				to,
			},
		};
	}
}
