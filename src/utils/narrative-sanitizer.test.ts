import { describe, expect, test } from "vitest";
import {
	createCharacterMap,
	sanitizeNarrativeText,
} from "./narrative-sanitizer";

describe("sanitizeNarrativeText", () => {
	test("removes XML tags with content", () => {
		const input =
			"Hero attacks for <hp_damage targetId='enemy'>25</hp_damage> damage!";
		const result = sanitizeNarrativeText(input);
		expect(result).toBe("Hero attacks for damage!");
	});

	test("removes self-closing XML tags", () => {
		const input = "Now processing <topic characterId='hero' /> action.";
		const result = sanitizeNarrativeText(input);
		expect(result).toBe("Now processing action.");
	});

	test("removes simple opening/closing tags", () => {
		const input = "<source_name>attacks the goblin</source_name>";
		const result = sanitizeNarrativeText(input);
		expect(result).toBe("attacks the goblin");
	});

	test("handles multiple tag types in same text", () => {
		const input =
			"<source_name>casts heal for <hp_heal targetId='ally'>15</hp_heal> HP <topic characterId='ally' /></source_name>";
		const result = sanitizeNarrativeText(input);
		expect(result).toBe("casts heal for HP");
	});

	test("replaces character placeholders when map provided", () => {
		const input = "Hero attacks {enemy} for damage!";
		const charMap = new Map([["enemy", "Goblin"]]);
		const result = sanitizeNarrativeText(input, charMap);
		expect(result).toBe("Hero attacks Goblin for damage!");
	});

	test("cleans up extra whitespace", () => {
		const input = "  Multiple   spaces    here  ";
		const result = sanitizeNarrativeText(input);
		expect(result).toBe("Multiple spaces here");
	});
});

describe("createCharacterMap", () => {
	test("creates correct character map", () => {
		const characters = [
			{ id: "hero", name: "Hero" },
			{ id: "enemy", name: "Goblin" },
		];
		const map = createCharacterMap(characters);
		expect(map.get("hero")).toBe("Hero");
		expect(map.get("enemy")).toBe("Goblin");
	});
});
