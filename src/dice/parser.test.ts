import { describe, expect, it } from "vitest";
import { evaluate } from "./index";

describe("Dice Parser - Parentheses Support", () => {
	it("should handle simple precedence override with parentheses", () => {
		const { result, errors } = evaluate("(2 + 3) * 4");
		expect(errors).toHaveLength(0);
		expect(result).toBe(20);
	});

	it("should handle dice with parentheses", () => {
		const { result, errors } = evaluate("(1d4 + 1) * 2");
		expect(errors).toHaveLength(0);
		expect(typeof result).toBe("number");
		expect(result).toBeGreaterThanOrEqual(4); // (1 + 1) * 2 = 4 minimum
		expect(result).toBeLessThanOrEqual(10); // (4 + 1) * 2 = 10 maximum
	});
});
