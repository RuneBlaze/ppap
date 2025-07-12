import type { Token } from "./tokens";
import { TokenType } from "./tokens";

export class Lexer {
	private input: string;
	private position: number = 0;
	private readPosition: number = 0;
	private ch: string = "";
	private line: number = 1;
	private col: number = 1;

	private keywords: { [key: string]: TokenType } = {
		if: TokenType.If,
		then: TokenType.Then,
		else: TokenType.Else,
	};

	constructor(input: string) {
		this.input = input;
		this.readChar();
	}

	private readChar() {
		if (this.readPosition >= this.input.length) {
			this.ch = ""; // EOF
		} else {
			this.ch = this.input[this.readPosition];
		}
		this.position = this.readPosition;
		this.readPosition += 1;

		// Track line and column numbers for the new character
		if (this.position > 0 && this.input[this.position - 1] === "\n") {
			this.line += 1;
			this.col = 1;
		} else if (this.position > 0) {
			this.col += 1;
		}
	}

	private peekChar(): string {
		if (this.readPosition >= this.input.length) {
			return "";
		}
		return this.input[this.readPosition];
	}

	public nextToken(): Token {
		this.skipWhitespace();
		let token: Token;
		const currentLine = this.line;
		const currentCol = this.col;

		switch (this.ch) {
			case "+":
				token = {
					type: TokenType.Plus,
					lexeme: "+",
					line: currentLine,
					col: currentCol,
				};
				break;
			case "-":
				token = {
					type: TokenType.Minus,
					lexeme: "-",
					line: currentLine,
					col: currentCol,
				};
				break;
			case "*":
				token = {
					type: TokenType.Multiply,
					lexeme: "*",
					line: currentLine,
					col: currentCol,
				};
				break;
			case "/":
				token = {
					type: TokenType.Divide,
					lexeme: "/",
					line: currentLine,
					col: currentCol,
				};
				break;
			case "d":
				token = {
					type: TokenType.Dice,
					lexeme: "d",
					line: currentLine,
					col: currentCol,
				};
				break;
			case "(":
				token = {
					type: TokenType.LeftParen,
					lexeme: "(",
					line: currentLine,
					col: currentCol,
				};
				break;
			case ")":
				token = {
					type: TokenType.RightParen,
					lexeme: ")",
					line: currentLine,
					col: currentCol,
				};
				break;
			case ";":
				token = {
					type: TokenType.Semicolon,
					lexeme: ";",
					line: currentLine,
					col: currentCol,
				};
				break;
			case ">":
				if (this.peekChar() === "=") {
					this.readChar();
					token = {
						type: TokenType.GreaterThanOrEqual,
						lexeme: ">=",
						line: currentLine,
						col: currentCol,
					};
				} else {
					token = {
						type: TokenType.GreaterThan,
						lexeme: ">",
						line: currentLine,
						col: currentCol,
					};
				}
				break;
			case "<":
				if (this.peekChar() === "=") {
					this.readChar();
					token = {
						type: TokenType.LessThanOrEqual,
						lexeme: "<=",
						line: currentLine,
						col: currentCol,
					};
				} else {
					token = {
						type: TokenType.LessThan,
						lexeme: "<",
						line: currentLine,
						col: currentCol,
					};
				}
				break;
			case "=":
				if (this.peekChar() === "=") {
					this.readChar();
					token = {
						type: TokenType.Equals,
						lexeme: "==",
						line: currentLine,
						col: currentCol,
					};
				} else {
					token = {
						type: TokenType.EOF,
						lexeme: "",
						line: currentLine,
						col: currentCol,
					}; // Single = not supported
				}
				break;
			case "!":
				if (this.peekChar() === "=") {
					this.readChar();
					token = {
						type: TokenType.NotEquals,
						lexeme: "!=",
						line: currentLine,
						col: currentCol,
					};
				} else {
					token = {
						type: TokenType.EOF,
						lexeme: "",
						line: currentLine,
						col: currentCol,
					}; // Single ! not supported
				}
				break;
			case "":
				token = {
					type: TokenType.EOF,
					lexeme: "",
					line: currentLine,
					col: currentCol,
				};
				break;
			default:
				if (this.isDigit(this.ch)) {
					const numStr = this.readNumber();
					return {
						type: TokenType.Number,
						lexeme: numStr,
						literal: parseInt(numStr, 10),
						line: currentLine,
						col: currentCol,
					};
				} else if (this.isLetter(this.ch)) {
					const ident = this.readIdentifier();
					const tokenType = this.keywords[ident] || TokenType.Identifier;
					return {
						type: tokenType,
						lexeme: ident,
						line: currentLine,
						col: currentCol,
					};
				} else {
					token = {
						type: TokenType.INVALID,
						lexeme: this.ch,
						line: currentLine,
						col: currentCol,
					}; // Unknown character
				}
		}

		this.readChar();
		return token;
	}

	private readIdentifier(): string {
		const start = this.position;
		while (this.isLetter(this.ch)) {
			this.readChar();
		}
		return this.input.substring(start, this.position);
	}

	private isLetter(ch: string): boolean {
		return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
	}

	private skipWhitespace() {
		while (
			this.ch === " " ||
			this.ch === "\t" ||
			this.ch === "\n" ||
			this.ch === "\r"
		) {
			this.readChar();
		}
	}

	private readNumber(): string {
		const startPosition = this.position;
		while (this.isDigit(this.ch)) {
			this.readChar();
		}
		return this.input.substring(startPosition, this.position);
	}

	private isDigit(ch: string): boolean {
		return ch >= "0" && ch <= "9";
	}
}
