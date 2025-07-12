import { google } from "@ai-sdk/google";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import "ses";

Laminar.initialize({
	projectApiKey: process.env.LMNR_API_KEY,
});

// Create a secure compartment for JavaScript evaluation
const jsCompartment = new Compartment({
	print: harden(console.log),
	// Common useful modules and utilities
	Math: harden(Math),
	JSON: harden(JSON),
	Array: harden(Array),
	Object: harden(Object),
	String: harden(String),
	Number: harden(Number),
	Boolean: harden(Boolean),
	Date: harden(Date),
	RegExp: harden(RegExp),
	// Utility functions
	sum: harden((arr: number[]) => arr.reduce((a, b) => a + b, 0)),
	avg: harden((arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length),
	min: harden((arr: number[]) => Math.min(...arr)),
	max: harden((arr: number[]) => Math.max(...arr)),
	range: harden((start: number, end: number) =>
		Array.from({ length: end - start + 1 }, (_, i) => start + i),
	),
	factorial: harden((n: number) => {
		if (n <= 1) return 1;
		let result = 1;
		for (let i = 2; i <= n; i++) {
			result *= i;
		}
		return result;
	}),
});

const { textStream } = await streamText({
	model: google("gemini-2.5-flash-preview-05-20"),
	prompt:
		"Please demonstrate both tools: First, roll some dice (try 3d8), then use JavaScript to calculate something interesting with the results, like finding the average or checking if the total is even.",
	stopWhen: stepCountIs(5),
	experimental_telemetry: {
		isEnabled: true,
		tracer: getTracer(),
	},
	tools: {
		diceRoll: tool({
			description:
				"Roll dice using XdY format (e.g., 2d6 for two six-sided dice)",
			inputSchema: z.object({
				diceExpression: z
					.string()
					.describe(
						'Dice expression in XdY format, e.g., "2d6", "1d20", "3d8"',
					),
			}),
			execute: async ({ diceExpression }) => {
				// Parse naive XdY format
				const match = diceExpression.match(/^(\d+)d(\d+)$/i);
				if (!match) {
					throw new Error(
						'Invalid dice expression. Use format like "2d6" or "1d20"',
					);
				}

				const numDice = parseInt(match[1]);
				const numSides = parseInt(match[2]);

				if (numDice <= 0 || numSides <= 0) {
					throw new Error("Number of dice and sides must be positive");
				}

				const rolls: number[] = [];
				for (let i = 0; i < numDice; i++) {
					rolls.push(Math.floor(Math.random() * numSides) + 1);
				}

				return {
					expression: diceExpression,
					rolls,
					total: rolls.reduce((sum, roll) => sum + roll, 0),
				};
			},
		}),

		evalJavaScript: tool({
			description:
				"Evaluate JavaScript expressions safely using SES compartment. Available utilities: Math, JSON, Array, Object, String, Number, Boolean, Date, RegExp, sum(arr), avg(arr), min(arr), max(arr), range(start, end), factorial(n)",
			inputSchema: z.object({
				expression: z
					.string()
					.describe(
						'JavaScript expression to evaluate, e.g., "2 + 3", "Math.max(1, 5)", "sum([1, 2, 3])", "avg(range(1, 10))"',
					),
			}),
			execute: async ({ expression }) => {
				try {
					const result = jsCompartment.evaluate(expression);
					return {
						expression,
						result,
						type: typeof result,
					};
				} catch (error) {
					throw new Error(
						`JavaScript evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			},
		}),
	},
});

for await (const textPart of textStream) {
	console.log(textPart);
}
