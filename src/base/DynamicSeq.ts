/*
 * DynamicSeq: A dynamic array with tombstoning and secondary indices.
 *
 * This collection behaves like a standard array but uses a "tombstone"
 * strategy for deletions. Instead of removing items, it marks them as "dead".
 * This avoids expensive array shifting on removal, making deletions O(1).
 *
 * The trade-off is that iteration skips dead items, and over time the internal
 * array may grow large with tombstones. A `compact()` method is provided to
 * permanently remove dead items and shrink the internal storage.
 *
 * Features:
 *  - Fast O(1) `push` and `pop`.
 *  - O(1) "soft" deletions via `retain`/`reject`.
 *  - Opt-in secondary indices for fast lookups on object properties.
 *  - Array-like access by logical index (e.g., `at(0)` gets the first live item).
 */

// =============================================================================
// Utility Types
// =============================================================================
interface Slot<T> {
	value: T;
	dead: boolean;
}

export interface FindResult<T> {
	value: T | undefined;
	index: number;
}

export interface SecondaryIndexAccessor<T, K extends keyof T> {
	get(value: T[K]): Iterable<T>;
	bucketSize(value: T[K]): number;
	values(): Iterable<T[K]>;
	distinctCount(): number;
}

// =============================================================================
// Main Class
// =============================================================================
export class DynamicSeq<T> implements Iterable<T> {
	private slots: Slot<T>[] = [];
	private _live = 0;
	private _dead = 0;
	private readonly deadRatioThreshold: number;

	private indexFields = new Set<keyof T>();
	private indicesMaps: Record<string, Map<any, Set<number>>> = {};
	public readonly indices: Record<string, SecondaryIndexAccessor<T, any>> = {};

	constructor(opts: { deadRatioThreshold?: number } = {}) {
		this.deadRatioThreshold = opts.deadRatioThreshold ?? 0.2;
	}

	// Properties
	get length(): number {
		return this._live;
	}
	get capacity(): number {
		return this.slots.length;
	}
	get dead(): number {
		return this._dead;
	}

	// Iterable
	*[Symbol.iterator](): Iterator<T> {
		for (const slot of this.slots) {
			if (!slot.dead) {
				yield slot.value;
			}
		}
	}

	// Insertion
	push(item: T): void {
		const slot = { value: item, dead: false };
		const internalIndex = this.slots.length;
		this.slots.push(slot);
		this._live++;
		this.addToIndices(item, internalIndex);
	}

	// Deletion
	pop(): T | undefined {
		for (let i = this.slots.length - 1; i >= 0; i--) {
			const slot = this.slots[i];
			if (slot && !slot.dead) {
				slot.dead = true;
				this._live--;
				this._dead++;
				// No need to remove from indices; iterators will skip dead slots.
				this._maintenance();
				return slot.value;
			}
		}
		return undefined;
	}

	removeAt(index: number): T | undefined {
		const physicalIndex = this._findPhysicalIndex(index);
		if (physicalIndex === -1) {
			return undefined;
		}
		const slot = this.slots[physicalIndex];

		if (slot.dead) {
			// This should not happen if _findPhysicalIndex is correct, but as a safeguard.
			return undefined;
		}

		slot.dead = true;
		this._live--;
		this._dead++;
		this._maintenance();
		return slot.value;
	}

	// Access by logical index (insertion order)
	at(index: number): T | undefined {
		const physicalIndex = this._findPhysicalIndex(index);
		if (physicalIndex === -1) {
			return undefined;
		}
		// The slot must exist and be live if physicalIndex is not -1
		return this.slots[physicalIndex].value;
	}
	nth(index: number): T | undefined {
		return this.at(index);
	}
	first(): T | undefined {
		return this.at(0);
	}
	last(): T | undefined {
		return this.at(-1);
	}

	// Higher-order functions
	each(fn: (item: T, idx: number) => void): void {
		let i = 0;
		for (const v of this) {
			fn(v, i++);
		}
	}

	find(fn: (item: T, idx: number) => boolean): FindResult<T> {
		let i = 0;
		for (const v of this) {
			if (fn(v, i)) {
				return { value: v, index: i };
			}
			i++;
		}
		return { value: undefined, index: -1 };
	}
	detect(fn: (item: T, idx: number) => boolean): T | undefined {
		return this.find(fn).value;
	}

	some(fn: (item: T, idx: number) => boolean): boolean {
		let i = 0;
		for (const v of this) {
			if (fn(v, i++)) return true;
		}
		return false;
	}
	every(fn: (item: T, idx: number) => boolean): boolean {
		let i = 0;
		for (const v of this) {
			if (!fn(v, i++)) return false;
		}
		return true;
	}
	reduce<U>(fn: (acc: U, item: T, idx: number) => U, initial: U): U {
		let acc = initial;
		let i = 0;
		for (const v of this) {
			acc = fn(acc, v, i++);
		}
		return acc;
	}

	// In-place mutation
	retain(predicate: (item: T, idx: number) => boolean): number {
		let removed = 0;
		let logicalIdx = 0;
		for (const slot of this.slots) {
			if (!slot.dead) {
				if (!predicate(slot.value, logicalIdx++)) {
					slot.dead = true;
					this._live--;
					this._dead++;
					removed++;
				}
			}
		}
		if (removed > 0) {
			this._maintenance();
		}
		return removed;
	}

	reject(predicate: (item: T, idx: number) => boolean): number {
		return this.retain((v, i) => !predicate(v, i));
	}

	clear(): void {
		if (this._live === 0) return;
		for (const slot of this.slots) {
			if (!slot.dead) {
				slot.dead = true;
			}
		}
		this._dead += this._live;
		this._live = 0;
		for (const field of this.indexFields) {
			this.indicesMaps[field as string].clear();
		}
		this._maintenance();
	}

	// Secondary Indices
	addIndex<K extends keyof T & string>(field: K): void {
		if (this.indexFields.has(field)) return;

		this.indexFields.add(field);
		const map = new Map<any, Set<number>>();
		this.indicesMaps[field] = map;

		const accessor: SecondaryIndexAccessor<T, K> = {
			get: (value: T[K]) => this.iterBucket(field, value),
			bucketSize: (value: T[K]) => this.getBucketSize(field, value),
			values: () => map.keys(),
			distinctCount: () => map.size,
		};
		this.indices[field] = accessor;

		// Backfill index
		for (let i = 0; i < this.slots.length; i++) {
			const slot = this.slots[i];
			if (!slot.dead) {
				this.addIndexEntry(field, slot.value[field], i);
			}
		}
	}

	getBy<K extends keyof T & string>(field: K, value: T[K]): Iterable<T> {
		if (!this.indexFields.has(field)) {
			throw new Error(`No index on ${String(field)}`);
		}
		return this.iterBucket(field, value);
	}

	private addIndexEntry(
		field: keyof T,
		value: any,
		internalIndex: number,
	): void {
		const map = this.indicesMaps[field as string];
		if (!map) return;
		let set = map.get(value);
		if (!set) {
			set = new Set<number>();
			map.set(value, set);
		}
		set.add(internalIndex);
	}

	private addToIndices(item: T, internalIndex: number) {
		for (const field of this.indexFields) {
			this.addIndexEntry(field, (item as any)[field], internalIndex);
		}
	}

	private *iterBucket<K extends keyof T>(field: K, value: T[K]): Iterable<T> {
		const map = this.indicesMaps[field as string];
		if (!map) return;
		const set = map.get(value);
		if (!set) return;
		for (const internalId of set) {
			const slot = this.slots[internalId];
			if (slot && !slot.dead) {
				yield slot.value;
			}
		}
	}

	private getBucketSize<K extends keyof T>(field: K, value: T[K]): number {
		const map = this.indicesMaps[field as string];
		if (!map) return 0;
		const set = map.get(value);
		if (!set) return 0;

		let count = 0;
		for (const internalId of set) {
			if (this.slots[internalId] && !this.slots[internalId].dead) {
				count++;
			}
		}
		return count;
	}

	private _maintenance(): void {
		if (this.capacity === 0) return;

		const deadRatio = this.dead / this.capacity;
		if (deadRatio < this.deadRatioThreshold) return;

		// As the dead ratio exceeds the threshold, the probability of compaction increases.
		const excessRatio =
			(deadRatio - this.deadRatioThreshold) / (1 - this.deadRatioThreshold);
		if (Math.random() < excessRatio) {
			this.compact();
		}
	}

	private _findPhysicalIndex(logicalIndex: number): number {
		if (logicalIndex >= this.length || logicalIndex < -this.length) {
			return -1;
		}

		if (logicalIndex >= 0) {
			let currentLogical = 0;
			for (let i = 0; i < this.slots.length; i++) {
				if (!this.slots[i].dead) {
					if (currentLogical === logicalIndex) {
						return i;
					}
					currentLogical++;
				}
			}
		} else {
			// Negative index
			let currentLogical = -1;
			for (let i = this.slots.length - 1; i >= 0; i--) {
				if (!this.slots[i].dead) {
					if (currentLogical === logicalIndex) {
						return i;
					}
					currentLogical--;
				}
			}
		}
		return -1; // Should be unreachable
	}

	private rebuildAllIndices(): void {
		for (const field of this.indexFields) {
			const map = this.indicesMaps[field as string];
			map.clear();
			for (let i = 0; i < this.slots.length; i++) {
				const slot = this.slots[i];
				if (!slot.dead) {
					this.addIndexEntry(field, (slot.value as any)[field], i);
				}
			}
		}
	}

	// Maintenance
	needsCompaction(): boolean {
		return (
			this.capacity > 0 && this.dead / this.capacity >= this.deadRatioThreshold
		);
	}

	compact(): void {
		if (this._dead === 0) return;
		const oldSlots = this.slots;
		this.slots = [];
		this._live = 0;
		this._dead = 0;

		for (const field of this.indexFields) {
			this.indicesMaps[field as string].clear();
		}

		for (const slot of oldSlots) {
			if (!slot.dead) {
				this.push(slot.value);
			}
		}
	}
}
