import { describe, expect, test } from "vitest";
import {
	BloomFilter,
	DenseFilter,
	defaultTokenizer,
	TinyFTS,
} from "./TinyFTS";

describe("TinyFTS", () => {
	test("basic document addition and search", () => {
		const fts = new TinyFTS();

		const id1 = fts.addDocument("The quick brown fox jumps");
		const id2 = fts.addDocument("The lazy dog sleeps all day");

		expect(id1).toBe(0);
		expect(id2).toBe(1);
		expect(fts.size()).toBe(2);

		const results = fts.search("quick fox");
		expect(results).toHaveLength(1);
		expect(results[0].document.text).toBe("The quick brown fox jumps");
	});

	test("search with metadata", () => {
		const fts = new TinyFTS();

		fts.addDocument("Card game rules", { type: "rule", category: "game" });
		fts.addDocument("Board game instructions", {
			type: "instruction",
			category: "game",
		});

		const results = fts.search("game");
		expect(results).toHaveLength(2);
		expect(results[0].document.metadata?.category).toBe("game");
	});

	test("tf-idf scoring prioritizes relevant documents", () => {
		const fts = new TinyFTS();

		// Document with single occurrence of rare term
		fts.addDocument("rare specialized term");
		// Document with common terms
		fts.addDocument("the the the common common word");
		// Document with query term repeated
		fts.addDocument("specialized specialized specialized term term");

		const results = fts.search("specialized term");
		expect(results).toHaveLength(2);
		// Document with more occurrences should score higher
		expect(results[0].document.text).toBe(
			"specialized specialized specialized term term",
		);
	});

	test("search options limit and threshold", () => {
		const fts = new TinyFTS();

		fts.addDocument("first document with word");
		fts.addDocument("second document with word");
		fts.addDocument("third document with word");

		const limitedResults = fts.search("word", { limit: 2 });
		expect(limitedResults).toHaveLength(2);

		const allResults = fts.search("word");
		expect(allResults).toHaveLength(3);
	});

	test("empty query returns no results", () => {
		const fts = new TinyFTS();
		fts.addDocument("some content");

		const results = fts.search("");
		expect(results).toHaveLength(0);
	});

	test("query with no matching documents", () => {
		const fts = new TinyFTS();
		fts.addDocument("hello world");

		const results = fts.search("nonexistent");
		expect(results).toHaveLength(0);
	});

	test("getDocument retrieves correct document", () => {
		const fts = new TinyFTS();

		const id = fts.addDocument("test document", { key: "value" });
		const doc = fts.getDocument(id);

		expect(doc?.id).toBe(id);
		expect(doc?.text).toBe("test document");
		expect(doc?.metadata?.key).toBe("value");
	});

	test("different filter types work", () => {
		const bloomFts = new TinyFTS({ filterType: "bloom" });
		const denseFts = new TinyFTS({ filterType: "dense" });

		const text = "test document content";

		bloomFts.addDocument(text);
		denseFts.addDocument(text);

		expect(bloomFts.search("test")).toHaveLength(1);
		expect(denseFts.search("test")).toHaveLength(1);
	});

	test("custom tokenizer works", () => {
		const customTokenizer = (text: string) => text.split(" ");
		const fts = new TinyFTS({ tokenizer: customTokenizer });

		fts.addDocument("Hello-World Test-Case");

		// With custom tokenizer, hyphenated words stay together
		const results1 = fts.search("Hello-World");
		expect(results1).toHaveLength(1);

		// Default tokenizer splits "Hello-World" into ["hello", "world"]
		const defaultFts = new TinyFTS();
		defaultFts.addDocument("Hello-World Test-Case");

		// Searching for "Hello-World" tokens as ["hello", "world"] - both present, so should match
		const results2 = defaultFts.search("hello world");
		expect(results2).toHaveLength(1);

		// But searching for the hyphenated string won't work because it becomes ["hello", "world"] query
		const results3 = defaultFts.search("Hello-World");
		expect(results3).toHaveLength(1); // Actually this WILL match because both tokens are present
	});
});

describe("Filters", () => {
	test("BloomFilter basic functionality", () => {
		const filter = new BloomFilter(1000);
		const hash = BigInt("0x123456789abcdef0");

		expect(filter.contains(hash)).toBe(false);
		filter.add(hash);
		expect(filter.contains(hash)).toBe(true);
	});


	test("DenseFilter basic functionality", () => {
		const filter = new DenseFilter();
		const hash = BigInt("0x123456789abcdef0");

		expect(filter.contains(hash)).toBe(false);
		filter.add(hash);
		expect(filter.contains(hash)).toBe(true);
	});
});

describe("defaultTokenizer", () => {
	test("tokenizes text correctly", () => {
		const tokens = defaultTokenizer("Hello, World! Test123 #hashtag");
		expect(tokens).toEqual(["hello", "world", "test123", "hashtag"]);
	});

	test("handles empty string", () => {
		const tokens = defaultTokenizer("");
		expect(tokens).toEqual([]);
	});

	test("handles only punctuation", () => {
		const tokens = defaultTokenizer("!@#$%^&*()");
		expect(tokens).toEqual([]);
	});
});
