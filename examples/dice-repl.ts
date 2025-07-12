#!/usr/bin/env bun

import { evaluate, type DiceError } from "../src/dice";
import { Lexer } from "../src/dice/lexer";
import { TokenType, type Token } from "../src/dice/tokens";
import * as readline from "node:readline";

// ANSI color codes for pretty output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	bgRed: "\x1b[41m",
	bgGreen: "\x1b[42m",
} as const;

function colorize(text: string, color: keyof typeof colors): string {
	return `${colors[color]}${text}${colors.reset}`;
}

// Token color mapping
const tokenColors = {
	[TokenType.Number]: "cyan",
	[TokenType.Dice]: "magenta",
	[TokenType.If]: "yellow",
	[TokenType.Then]: "yellow",
	[TokenType.Else]: "yellow",
	[TokenType.Plus]: "green",
	[TokenType.Minus]: "green",
	[TokenType.Multiply]: "green",
	[TokenType.Divide]: "green",
	[TokenType.Equals]: "blue",
	[TokenType.NotEquals]: "blue",
	[TokenType.GreaterThan]: "blue",
	[TokenType.LessThan]: "blue",
	[TokenType.GreaterThanOrEqual]: "blue",
	[TokenType.LessThanOrEqual]: "blue",
	[TokenType.LeftParen]: "white",
	[TokenType.RightParen]: "white",
	[TokenType.Semicolon]: "dim",
	[TokenType.Identifier]: "white",
	[TokenType.INVALID]: "red",
} as const;

function colorizeInput(input: string): string {
	if (!input.trim()) return input;

	try {
		const lexer = new Lexer(input);
		const tokens: Token[] = [];
		let token = lexer.nextToken();

		while (token.type !== TokenType.EOF) {
			tokens.push(token);
			token = lexer.nextToken();
		}

		// Build colorized string
		let result = "";
		let lastEnd = 0;

		for (const token of tokens) {
			// Add any whitespace before this token
			const tokenStart = (token.col || 1) - 1;
			if (tokenStart > lastEnd) {
				result += input.substring(lastEnd, tokenStart);
			}

			// Add colorized token
			const color = tokenColors[token.type] || "white";
			result += colorize(token.lexeme, color as keyof typeof colors);
			lastEnd = tokenStart + token.lexeme.length;
		}

		// Add any remaining input
		if (lastEnd < input.length) {
			result += input.substring(lastEnd);
		}

		return result;
	} catch (error) {
		// If tokenization fails, return original input
		return input;
	}
}

function printWelcome() {
	console.log(colorize("🎲 Welcome to the Dice Parser REPL!", "bright"));
	console.log(colorize("=".repeat(40), "cyan"));
	console.log("");
	console.log("This is an interactive dice expression evaluator.");
	console.log("You can use:");
	console.log(colorize("  • Basic math:", "yellow"), "3 + 4 * 2");
	console.log(colorize("  • Dice rolls:", "yellow"), "1d20, 2d6+3, 3d8-1");
	console.log(colorize("  • Parentheses:", "yellow"), "(1d4+1) * 2");
	console.log(
		colorize("  • Conditionals:", "yellow"),
		"if 1d20 > 15 then 2d6 else 1d4",
	);
	console.log(colorize("  • Multiple statements:", "yellow"), "1d6; 2d8+2");
	console.log("");
	console.log(colorize("Commands:", "magenta"));
	console.log(colorize("  .help", "cyan"), "    - Show this help");
	console.log(colorize("  .examples", "cyan"), " - Show example expressions");
	console.log(colorize("  .clear", "cyan"), "   - Clear screen");
	console.log(colorize("  .exit", "cyan"), "    - Exit REPL");
	console.log("");
	console.log(colorize("=".repeat(40), "cyan"));
	console.log("");
}

function printExamples() {
	console.log(colorize("📚 Example Expressions:", "bright"));
	console.log(colorize("-".repeat(25), "cyan"));

	const examples = [
		{ desc: "Simple dice roll", expr: "1d20" },
		{ desc: "Dice with modifier", expr: "1d20 + 5" },
		{ desc: "Multiple dice", expr: "2d6 + 3" },
		{ desc: "Complex expression", expr: "(2d4 + 1) * 3" },
		{ desc: "Conditional roll", expr: "if 1d20 >= 15 then 2d6 else 1d4" },
		{ desc: "Multiple statements", expr: "1d6; 2d8 + 2; 1d20" },
		{ desc: "Arithmetic only", expr: "(5 + 3) * 2 - 1" },
	];

	for (const { desc, expr } of examples) {
		console.log(
			`  ${colorize(desc + ":", "yellow")} ${colorize(expr, "white")}`,
		);
	}
	console.log("");
}

function formatResult(result: any): string {
	if (typeof result === "number") {
		return colorize(result.toString(), "green");
	}

	if (Array.isArray(result)) {
		return result.map((r) => formatResult(r)).join(colorize(", ", "dim"));
	}

	if (typeof result === "object" && result !== null) {
		return colorize(JSON.stringify(result, null, 2), "green");
	}

	return colorize(String(result), "green");
}

function formatError(error: DiceError): string {
	if (error.type === "parse") {
		const locationInfo = colorize(
			`(line ${error.line}, col ${error.col})`,
			"dim",
		);
		return `${colorize("✗ Parse Error:", "red")} ${error.message} ${locationInfo}`;
	} else {
		return `${colorize("✗ Evaluation Error:", "red")} ${error.message}`;
	}
}

function evaluateExpression(input: string): void {
	const { result, errors } = evaluate(input.trim());

	if (errors.length > 0) {
		console.log(colorize("Errors:", "red"));
		for (const error of errors) {
			console.log(`  ${formatError(error)}`);
		}
	} else {
		console.log(`${colorize("→", "cyan")} ${formatResult(result)}`);
	}
}

function handleCommand(command: string): boolean {
	switch (command.toLowerCase()) {
		case ".help":
			printWelcome();
			return true;
		case ".examples":
			printExamples();
			return true;
		case ".clear":
			console.clear();
			printWelcome();
			return true;
		case ".exit":
			console.log(colorize("👋 Goodbye!", "yellow"));
			return false;
		default:
			console.log(colorize(`Unknown command: ${command}`, "red"));
			console.log("Type .help for available commands");
			return true;
	}
}

// Dice expression keywords for tab completion
const DICE_KEYWORDS = [
	"if",
	"then",
	"else",
	"and",
	"or",
	"not",
	"d4",
	"d6",
	"d8",
	"d10",
	"d12",
	"d20",
	"d100",
	"1d4",
	"1d6",
	"1d8",
	"1d10",
	"1d12",
	"1d20",
	"1d100",
	"2d6",
	"3d6",
	"4d6",
];

const COMMANDS = [".help", ".examples", ".clear", ".exit"];

// Tab completion function
function completer(line: string): [string[], string] {
	const completions = [...DICE_KEYWORDS, ...COMMANDS];
	const hits = completions.filter((c) => c.startsWith(line));
	return [hits.length ? hits : completions, line];
}

async function startRepl() {
	printWelcome();

	// Create readline interface with history and tab completion
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: colorize("🎲 ", "magenta") + colorize("> ", "cyan"),
		completer: completer,
		history: [], // Enable command history
	});

	// Custom input handling for syntax highlighting
	let currentInput = "";
	const basePrompt = colorize("🎲 ", "magenta") + colorize("> ", "cyan");

	// Override the default line handling to add syntax highlighting
	rl.on("line", (input: string) => {
		const trimmedInput = input.trim();
		currentInput = ""; // Reset current input

		// Handle empty input
		if (!trimmedInput) {
			rl.prompt();
			return;
		}

		// Handle commands
		if (trimmedInput.startsWith(".")) {
			const shouldContinue = handleCommand(trimmedInput);
			if (!shouldContinue) {
				rl.close();
				return;
			}
			rl.prompt();
			return;
		}

		// Evaluate expression
		try {
			evaluateExpression(trimmedInput);
		} catch (error) {
			console.log(colorize(`Internal error: ${error}`, "red"));
		}

		console.log(""); // Add spacing between evaluations
		rl.prompt();
	});

	// Handle keypress events for real-time syntax highlighting
	process.stdin.on("keypress", (str, key) => {
		if (!key) return;

		// Handle special keys
		if (key.ctrl && key.name === "c") {
			return; // Let readline handle Ctrl+C
		}

		// For regular typing, update the display with syntax highlighting
		setTimeout(() => {
			const line = rl.line || "";
			if (line !== currentInput) {
				currentInput = line;

				// Clear the current line and redraw with syntax highlighting
				process.stdout.write("\r\x1b[K"); // Clear line
				process.stdout.write(basePrompt);

				if (line) {
					const colorizedLine = colorizeInput(line);
					process.stdout.write(colorizedLine);
				}
			}
		}, 0);
	});

	rl.on("close", () => {
		console.log(colorize("\n👋 Goodbye!", "yellow"));
		process.exit(0);
	});

	// Handle Ctrl+C gracefully
	rl.on("SIGINT", () => {
		console.log(colorize("\n👋 Goodbye!", "yellow"));
		rl.close();
	});

	// Enable keypress events
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}
	require("readline").emitKeypressEvents(process.stdin);

	// Start the prompt
	rl.prompt();
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
	console.log(colorize("\n👋 Goodbye!", "yellow"));
	process.exit(0);
});

// Start the REPL
startRepl().catch(console.error);
