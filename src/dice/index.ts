import type { EvaluationResult } from "./interpreter";
import { Interpreter } from "./interpreter";
import { Lexer } from "./lexer";
import { Parser, type ParseError } from "./parser";
import { tool } from "ai";
import { z } from "zod";

export interface EvaluationError {
	type: "evaluation";
	message: string;
}

export type DiceError = ParseError | EvaluationError;

export function evaluate(
	source: string,
	context?: Record<string, number>,
): {
	result: EvaluationResult | EvaluationResult[];
	errors: DiceError[];
} {
	const lexer = new Lexer(source);
	const parser = new Parser(lexer);
	const program = parser.parseProgram();

	if (parser.errors.length > 0) {
		return {
			result: -1,
			errors: parser.errors,
		};
	}

	try {
		const interpreter = new Interpreter();
		const result = interpreter.eval(program, context);
		return { result, errors: [] };
	} catch (error) {
		return {
			result: -1,
			errors: [
				{
					type: "evaluation",
					message: error instanceof Error ? error.message : String(error),
				},
			],
		};
	}
}

/**
 * Canonical dice rolling tool that supports advanced dice expressions.
 * Can be used with AI SDK for sophisticated dice mechanics.
 *
 * Supports:
 * - Basic dice: 2d6, 3d8, 1d20
 * - Math operations: 2d6+5, 3d8*2, 4d4-1
 * - Conditional logic: if 2d6 > 10 then 1d20 else 1d6
 * - Variables/context: strength+2d6 (with context: {strength: 15})
 * - Comparisons: 2d6 >= 8, 3d4 == 12
 */
export const diceRollTool = tool({
	description:
		"Roll dice using sophisticated expressions. Supports basic dice (2d6), math operations (2d6+5), conditionals (if 2d6 > 10 then 1d20 else 1d6), and variables.",
	inputSchema: z.object({
		expression: z
			.string()
			.describe(
				'Dice expression like "2d6", "3d8+5", "if 2d6 > 10 then 1d20 else 1d6", or "strength+2d6"',
			),
		context: z
			.record(z.string(), z.number())
			.optional()
			.describe(
				"Variables to use in the expression, e.g., {strength: 15, dexterity: 12}",
			),
	}),
	execute: async ({ expression, context }) => {
		const { result, errors } = evaluate(expression, context);

		if (errors.length > 0) {
			const errorMessages = errors.map((e) => e.message).join("; ");
			throw new Error(`Dice evaluation failed: ${errorMessages}`);
		}

		// Handle single result
		if (!Array.isArray(result)) {
			if (typeof result === "number") {
				return {
					expression,
					result,
					total: result,
					type: "number",
					context: context || {},
				};
			} else {
				// It's a RollResult
				return {
					expression,
					result: result.total,
					total: result.total,
					rolls: result.rolls,
					type: "dice",
					context: context || {},
				};
			}
		}

		// Handle multiple results (from multiple statements)
		const processedResults = result.map((r) => {
			if (typeof r === "number") {
				return { value: r, type: "number" };
			} else {
				return { value: r.total, rolls: r.rolls, type: "dice" };
			}
		});

		return {
			expression,
			results: processedResults,
			type: "multiple",
			context: context || {},
		};
	},
});
