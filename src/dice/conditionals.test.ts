import { describe, expect, it } from "vitest";
import { evaluate } from "./index";

describe("Conditional Logic", () => {
	it("should evaluate true condition correctly", () => {
		const { result, errors } = evaluate("if 10 > 5 then 1 else 0");
		expect(errors).toEqual([]);
		expect(result).toBe(1);
	});

	it("should evaluate false condition correctly", () => {
		const { result, errors } = evaluate("if 5 > 10 then 1 else 0");
		expect(errors).toEqual([]);
		expect(result).toBe(0);
	});

	it("should handle equals operator", () => {
		const { result, errors } = evaluate("if 5 == 5 then 42 else 0");
		expect(errors).toEqual([]);
		expect(result).toBe(42);
	});

	it("should handle not equals operator", () => {
		const { result, errors } = evaluate("if 3 != 5 then 7 else 0");
		expect(errors).toEqual([]);
		expect(result).toBe(7);
	});

	it("should handle greater than or equal operator", () => {
		const { result, errors } = evaluate("if 5 >= 5 then 1 else 0");
		expect(errors).toEqual([]);
		expect(result).toBe(1);
	});

	it("should handle less than or equal operator", () => {
		const { result, errors } = evaluate("if 3 <= 5 then 8 else 0");
		expect(errors).toEqual([]);
		expect(result).toBe(8);
	});

	it("should handle nested conditionals", () => {
		const { result, errors } = evaluate(
			"if 1 == 1 then (if 2 > 1 then 3 else 4) else 5",
		);
		expect(errors).toEqual([]);
		expect(result).toBe(3);
	});
});
