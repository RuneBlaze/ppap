import { describe, expect, test } from "vitest";
import { Lexer } from "./lexer";
import { Parser } from "./parser";

describe("Parser Error Handling", () => {
	test("incomplete dice expression '3d' should return descriptive error with location", () => {
		const lexer = new Lexer("3d");
		const parser = new Parser(lexer);
		parser.parseProgram();

		expect(parser.errors).toHaveLength(1);
		expect(parser.errors[0]).toMatchObject({
			message: expect.stringContaining("Incomplete dice expression"),
			line: expect.any(Number),
			col: expect.any(Number),
		});
	});

	test("mismatched parenthesis '(5 + 2' should return error about missing closing parenthesis", () => {
		const lexer = new Lexer("(5 + 2");
		const parser = new Parser(lexer);
		parser.parseProgram();

		expect(parser.errors).toHaveLength(1);
		expect(parser.errors[0]).toMatchObject({
			message: expect.stringContaining("Missing closing parenthesis"),
			line: expect.any(Number),
			col: expect.any(Number),
		});
	});

	test("invalid token '3 & 4' should return error about unexpected character with location", () => {
		const lexer = new Lexer("3 & 4");
		const parser = new Parser(lexer);
		parser.parseProgram();

		expect(parser.errors).toHaveLength(1);
		expect(parser.errors[0]).toMatchObject({
			message: expect.stringContaining("Invalid character"),
			line: expect.any(Number),
			col: expect.any(Number),
		});
	});

	test("valid expressions should return empty errors array", () => {
		const validExpressions = ["3d6", "2 + 3", "(4 * 5)", "if 1 then 2 else 3"];

		for (const expr of validExpressions) {
			const lexer = new Lexer(expr);
			const parser = new Parser(lexer);
			parser.parseProgram();

			expect(parser.errors).toHaveLength(0);
		}
	});

	test("error objects contain required properties", () => {
		const lexer = new Lexer("3d");
		const parser = new Parser(lexer);
		parser.parseProgram();

		expect(parser.errors).toHaveLength(1);
		const error = parser.errors[0];

		expect(error).toHaveProperty("message");
		expect(error).toHaveProperty("line");
		expect(error).toHaveProperty("col");
		expect(typeof error.message).toBe("string");
		expect(typeof error.line).toBe("number");
		expect(typeof error.col).toBe("number");
	});

	test("line and column tracking works correctly", () => {
		const lexer = new Lexer("valid\n&");
		const parser = new Parser(lexer);
		parser.parseProgram();

		expect(parser.errors).toHaveLength(1);

		// Error should be on line 2, column 1
		expect(parser.errors[0]).toMatchObject({
			message: expect.stringContaining("Invalid character"),
			line: 2,
			col: 1,
		});
	});
});
