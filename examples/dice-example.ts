import { evaluate } from "../src/dice";

function runExample(name: string, source: string) {
	console.log(`--- Running Example: ${name} ---`);
	console.log(`Input: ${source}`);
	const { result, errors } = evaluate(source);
	if (errors.length > 0) {
		console.error("Errors:", errors);
	} else {
		console.log("Result:", JSON.stringify(result, null, 2));
	}
	console.log("--- End Example ---\n");
}

// Simple math
runExample("Simple Arithmetic", "3 + 4 * 2");

// Simple dice roll
runExample("Single Dice Roll", "1d6");

// Dice roll with modifier
runExample("Dice Roll with Modifier", "2d8 + 4");

// Multiple statements
runExample("Multiple Statements", "1d4+1; 2d6+2");

// A more complex expression
runExample("Complex Expression", "1d20 + 2 * 3");

// Parentheses for precedence override
runExample("Precedence Override", "(2 + 3) * 4");

// Dice with parentheses
runExample("Dice with Parentheses", "(1d4 + 1) * 2");
