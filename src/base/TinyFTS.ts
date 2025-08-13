// TinyFTS - In-memory full-text search with probabilistic filters
// Based on the "tiny-but-works" blueprint with tf-idf scoring

// ===== 1. Basic filter abstraction =====
export interface IFilter {
	add(hash: bigint): void;
	contains(hash: bigint): boolean;
}

export class BloomFilter implements IFilter {
	private bits: Uint32Array;

	constructor(
		private readonly m: number,
		private readonly k: number = 4,
	) {
		this.bits = new Uint32Array(Math.ceil(m / 32));
	}

	add(h: bigint): void {
		const h1 = Number(h & BigInt(0xffffffff));
		const h2 = Number((h >> BigInt(32)) & BigInt(0xffffffff));
		for (let i = 0; i < this.k; ++i) {
			const idx = (h1 + i * h2) % this.m;
			this.bits[idx >>> 5] |= 1 << (idx & 31);
		}
	}

	contains(h: bigint): boolean {
		const h1 = Number(h & BigInt(0xffffffff));
		const h2 = Number((h >> BigInt(32)) & BigInt(0xffffffff));
		for (let i = 0; i < this.k; ++i) {
			const idx = (h1 + i * h2) % this.m;
			if ((this.bits[idx >>> 5] & (1 << (idx & 31))) === 0) return false;
		}
		return true;
	}
}


export class DenseFilter implements IFilter {
	private hashes = new Set<string>();

	add(hash: bigint): void {
		this.hashes.add(hash.toString());
	}

	contains(hash: bigint): boolean {
		return this.hashes.has(hash.toString());
	}
}

// ===== 2. Tokenizer =====
export type Tokenizer = (text: string) => string[];

export const defaultTokenizer: Tokenizer = (txt: string) =>
	txt.toLowerCase().match(/[a-z0-9]+/g) ?? [];

// ===== 3. Posting list BitSet =====
class BitSet {
	private readonly bits: Uint32Array;

	constructor(public readonly size: number) {
		this.bits = new Uint32Array(Math.ceil(size / 32));
	}

	set(i: number): void {
		this.bits[i >>> 5] |= 1 << (i & 31);
	}

	get(i: number): boolean {
		return (this.bits[i >>> 5] & (1 << (i & 31))) !== 0;
	}

	and(other: BitSet, out: BitSet): void {
		for (let i = 0; i < this.bits.length; ++i) {
			out.bits[i] = this.bits[i] & other.bits[i];
		}
	}

	any(): boolean {
		return this.bits.some((x) => x !== 0);
	}

	*indices(): Iterable<number> {
		for (let i = 0; i < this.size; ++i) {
			if (this.get(i)) yield i;
		}
	}
}

// ===== 4. Public API Types =====
export interface Document {
	id: number;
	text: string;
	metadata?: Record<string, any>;
}

export interface SearchResult {
	document: Document;
	score: number;
}

export interface SearchOptions {
	limit?: number;
	threshold?: number;
}

export interface TinyFTSOptions {
	tokenizer?: Tokenizer;
	filterType?: "bloom" | "dense";
	corpusFilterBits?: number;
}

// ===== 5. Main engine =====
export class TinyFTS {
	private docs: Document[] = [];
	private postings = new Map<bigint, BitSet>();
	private docFilters: IFilter[] = [];
	private corpusFilter: IFilter;
	private termFreqs = new Map<bigint, number>(); // for tf-idf
	private docTermCounts: number[] = []; // total terms per doc

	constructor(options: TinyFTSOptions = {}) {
		const {
			tokenizer = defaultTokenizer,
			filterType = "bloom",
			corpusFilterBits = 1 << 20,
		} = options;

		this.tokenizer = tokenizer;
		this.FilterCtor = this.getFilterConstructor(filterType);
		this.corpusFilter = new this.FilterCtor(corpusFilterBits);
	}

	private readonly tokenizer: Tokenizer;
	private readonly FilterCtor: new (
		m: number,
	) => IFilter;

	private getFilterConstructor(filterType: string): new (m: number) => IFilter {
		switch (filterType) {
			case "bloom":
				return BloomFilter;
			case "dense":
				return DenseFilter;
			default:
				return BloomFilter;
		}
	}

	addDocument(text: string, metadata?: Record<string, any>): number {
		const id = this.docs.length;
		const tokens = this.tokenizer(text);
		const uniqueTokens = new Set(tokens);
		const filter = new this.FilterCtor(Math.max(64, uniqueTokens.size * 8));

		// Track document term count for tf-idf
		this.docTermCounts[id] = tokens.length;

		// Process each unique token
		for (const tok of uniqueTokens) {
			const h = this.hash(tok);
			filter.add(h);
			this.corpusFilter.add(h);

			// Update term frequency (document frequency)
			this.termFreqs.set(h, (this.termFreqs.get(h) || 0) + 1);

			// Update posting list
			let bs = this.postings.get(h);
			if (!bs) {
				bs = new BitSet(1 << 20);
				this.postings.set(h, bs);
			}
			bs.set(id);
		}

		this.docs.push({ id, text, metadata });
		this.docFilters[id] = filter;
		return id;
	}

	search(query: string, options: SearchOptions = {}): SearchResult[] {
		const { limit = 50, threshold = 0 } = options;
		const qTokens = this.tokenizer(query);
		const qHashes = qTokens.map((tok) => this.hash(tok));

		// Early exit via corpus filter
		if (qHashes.every((h) => !this.corpusFilter.contains(h))) {
			return [];
		}

		// Start with all-set bitset and intersect
		let candidate = new BitSet(this.docs.length);
		for (let i = 0; i < this.docs.length; ++i) {
			candidate.set(i);
		}

		for (const h of qHashes) {
			const pl = this.postings.get(h);
			if (!pl) return []; // token unseen
			const next = new BitSet(this.docs.length);
			candidate.and(pl, next);
			candidate = next;
			if (!candidate.any()) return []; // short-circuit
		}

		// Filter false positives from per-doc filters and calculate scores
		const hits: SearchResult[] = [];
		for (const id of candidate.indices()) {
			if (qHashes.every((h) => this.docFilters[id].contains(h))) {
				const score = this.calculateTfIdfScore(qTokens, qHashes, id);
				if (score >= threshold) {
					hits.push({
						document: this.docs[id],
						score,
					});
				}
			}
		}

		// Sort by score descending, then by document length ascending
		hits.sort((a, b) => {
			if (Math.abs(a.score - b.score) < 1e-6) {
				return a.document.text.length - b.document.text.length;
			}
			return b.score - a.score;
		});

		return hits.slice(0, limit);
	}

	getDocument(id: number): Document | undefined {
		return this.docs[id];
	}

	size(): number {
		return this.docs.length;
	}

	private calculateTfIdfScore(
		queryTokens: string[],
		queryHashes: bigint[],
		docId: number,
	): number {
		const doc = this.docs[docId];
		const docTokens = this.tokenizer(doc.text);
		const docTermCount = this.docTermCounts[docId];
		const totalDocs = this.docs.length;

		// Calculate term frequencies in document
		const docTermFreq = new Map<string, number>();
		for (const token of docTokens) {
			docTermFreq.set(token, (docTermFreq.get(token) || 0) + 1);
		}

		let score = 0;
		const queryTermFreq = new Map<string, number>();

		// Calculate query term frequencies
		for (const token of queryTokens) {
			queryTermFreq.set(token, (queryTermFreq.get(token) || 0) + 1);
		}

		// Calculate tf-idf for each unique query term
		const processedTerms = new Set<string>();
		for (let i = 0; i < queryTokens.length; i++) {
			const token = queryTokens[i];
			const hash = queryHashes[i];

			if (processedTerms.has(token)) continue;
			processedTerms.add(token);

			const tf = (docTermFreq.get(token) || 0) / docTermCount;
			const df = this.termFreqs.get(hash) || 1;
			const idf = Math.log(totalDocs / df);
			const queryTf = (queryTermFreq.get(token) || 0) / queryTokens.length;

			score += tf * idf * queryTf;
		}

		return score;
	}

	private hash(str: string): bigint {
		// Simple 64-bit FNV-1a hash
		let h = BigInt("0xcbf29ce484222325");
		for (const ch of str) {
			h =
				((h ^ BigInt(ch.charCodeAt(0))) * BigInt("0x100000001b3")) &
				BigInt("0xffffffffffffffff");
		}
		return h;
	}
}
