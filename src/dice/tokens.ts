// src/dice/tokens.ts

export enum TokenType {
	// Literals
	Number = "Number",
	Identifier = "Identifier",

	// Keywords
	If = "If",
	Then = "Then",
	Else = "Else",

	// Operators
	Plus = "Plus",
	Minus = "Minus",
	Multiply = "Multiply",
	Divide = "Divide",
	Equals = "Equals",
	NotEquals = "NotEquals",
	GreaterThan = "GreaterThan",
	LessThan = "LessThan",
	GreaterThanOrEqual = "GreaterThanOrEqual",
	LessThanOrEqual = "LessThanOrEqual",

	// Dice operator
	Dice = "d",

	// Punctuation
	LeftParen = "LeftParen",
	RightParen = "RightParen",
	Semicolon = "Semicolon",

	// End of file
	EOF = "EOF",

	// Invalid token
	INVALID = "INVALID",
}

export interface Token {
	type: TokenType;
	lexeme: string;
	literal?: any;
	line?: number;
	col?: number;
}
