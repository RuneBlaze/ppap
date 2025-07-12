import { describe, expect, it } from "vitest";
import { evaluate } from "./index";
import type { RollResult } from "./interpreter";

describe("Context Support", () => {
	it("should evaluate variable lookup correctly", () => {
		const result = evaluate("2 + MIGHT", { MIGHT: 4 });
		expect(result.errors).toEqual([]);
		expect(result.result).toBe(6);
	});

	it("should return error for missing variable", () => {
		const result = evaluate("STR + 1", {});
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].type).toBe("evaluation");
		expect(result.errors[0].message).toContain("Unknown variable: STR");
	});

	it("should evaluate dice with variables", () => {
		const result = evaluate("1d6 + BONUS", { BONUS: 3 });
		expect(result.errors).toEqual([]);
		const total =
			typeof result.result === "number"
				? result.result
				: (result.result as RollResult).total;
		expect(total).toBeGreaterThanOrEqual(4);
		expect(total).toBeLessThanOrEqual(9);
	});

	it("should evaluate multiple variables", () => {
		const result = evaluate("STR + DEX", { STR: 10, DEX: 14 });
		expect(result.errors).toEqual([]);
		expect(result.result).toBe(24);
	});
});
