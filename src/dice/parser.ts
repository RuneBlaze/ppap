import type {
	BinaryOp,
	DiceRoll,
	Expression,
	Identifier,
	IfExpression,
	NumericLiteral,
	Program,
	Statement,
} from "./ast";
import type { Lexer } from "./lexer";
import type { Token } from "./tokens";
import { TokenType } from "./tokens";

export interface ParseError {
	type: "parse";
	message: string;
	line: number;
	col: number;
}

enum Precedence {
	LOWEST,
	EQUALS, // ==, !=
	LESSGREATER, // >, <, >=, <=
	SUM, // +, -
	PRODUCT, // *, /
	PREFIX, // -X or !X
	CALL, // myFunction(X)
	DICE, // 2d6
}

const precedences: Partial<Record<TokenType, Precedence>> = {
	[TokenType.Equals]: Precedence.EQUALS,
	[TokenType.NotEquals]: Precedence.EQUALS,
	[TokenType.GreaterThan]: Precedence.LESSGREATER,
	[TokenType.LessThan]: Precedence.LESSGREATER,
	[TokenType.GreaterThanOrEqual]: Precedence.LESSGREATER,
	[TokenType.LessThanOrEqual]: Precedence.LESSGREATER,
	[TokenType.Plus]: Precedence.SUM,
	[TokenType.Minus]: Precedence.SUM,
	[TokenType.Multiply]: Precedence.PRODUCT,
	[TokenType.Divide]: Precedence.PRODUCT,
	[TokenType.Dice]: Precedence.DICE,
};

export class Parser {
	private lexer: Lexer;
	private currentToken: Token;
	private peekToken: Token;
	public errors: ParseError[] = [];

	constructor(lexer: Lexer) {
		this.lexer = lexer;
		this.currentToken = this.lexer.nextToken();
		this.peekToken = this.lexer.nextToken();
	}

	private nextToken() {
		this.currentToken = this.peekToken;
		this.peekToken = this.lexer.nextToken();
	}

	private addError(message: string, token?: Token) {
		const errorToken = token || this.currentToken;
		this.errors.push({
			type: "parse",
			message,
			line: errorToken.line || 1,
			col: errorToken.col || 1,
		});
	}

	public parseProgram(): Program {
		const program: Program = {
			type: "Program",
			body: [],
		};

		while (this.currentToken.type !== TokenType.EOF) {
			const stmt = this.parseStatement();
			if (stmt) {
				program.body.push(stmt);
			}
			this.nextToken();
		}

		return program;
	}

	private parseStatement(): Statement | null {
		switch (this.currentToken.type) {
			case TokenType.Semicolon:
				return null;
			default:
				return this.parseExpressionStatement();
		}
	}

	private parseExpressionStatement(): Statement {
		const expression = this.parseExpression(Precedence.LOWEST);

		if (this.peekToken.type === TokenType.Semicolon) {
			this.nextToken();
		}

		return expression;
	}

	private parseExpression(precedence: Precedence): Expression {
		let leftExp = this.parsePrefix();

		while (
			this.peekToken.type !== TokenType.Semicolon &&
			precedence < this.peekPrecedence()
		) {
			this.nextToken();
			leftExp = this.parseInfixExpression(leftExp);
		}

		return leftExp;
	}

	private parsePrefix = (): Expression => {
		switch (this.currentToken.type) {
			case TokenType.Number:
				return this.parseNumericLiteral();
			case TokenType.Identifier:
				return this.parseIdentifier();
			case TokenType.LeftParen:
				return this.parseGroupedExpression();
			case TokenType.If:
				return this.parseIfExpression();
			case TokenType.INVALID:
				this.addError(
					`Invalid character '${this.currentToken.lexeme}' at line ${this.currentToken.line}, column ${this.currentToken.col}.`,
				);
				// This is not ideal, but for now we will return a dummy numeric literal.
				return { type: "NumericLiteral", value: 0 };
			default:
				this.addError(
					`Unexpected token '${this.currentToken.lexeme}'. Expected a number, identifier, '(', or 'if'.`,
				);
				// This is not ideal, but for now we will return a dummy numeric literal.
				return { type: "NumericLiteral", value: 0 };
		}
	};

	private parseInfixExpression = (left: Expression): Expression => {
		const operator = this.currentToken;
		const precedence = this.currentPrecedence();
		this.nextToken();

		if (operator.type === TokenType.Dice) {
			// Check if we have a proper right operand for the dice expression
			if (
				this.currentToken.type === TokenType.EOF ||
				this.currentToken.type === TokenType.Semicolon
			) {
				this.addError(
					`Incomplete dice expression. Expected a number after 'd'.`,
				);
				return {
					type: "DiceRoll",
					count: left,
					sides: { type: "NumericLiteral", value: 0 },
				} as DiceRoll;
			}

			const right = this.parseExpression(precedence);
			// Validate that the right side of a dice expression should be a number
			if (right.type !== "NumericLiteral") {
				this.addError(
					`Dice expression requires a number after 'd'. Got '${this.currentToken.lexeme}' instead.`,
				);
			}
			return { type: "DiceRoll", count: left, sides: right } as DiceRoll;
		}

		const right = this.parseExpression(precedence);
		return { type: "BinaryOp", left, operator, right } as BinaryOp;
	};

	private parseIfExpression(): IfExpression {
		// We are already on the 'if' token, move to the next token to start parsing condition
		this.nextToken();

		const condition = this.parseExpression(Precedence.LOWEST);

		if (!this.expectPeek(TokenType.Then)) {
			this.addError(
				`Expected 'then' after if condition, got '${this.peekToken.lexeme}' instead.`,
				this.peekToken,
			);
			return {
				type: "IfExpression",
				condition,
				consequence: { type: "NumericLiteral", value: 0 },
				alternative: { type: "NumericLiteral", value: 0 },
			};
		}

		this.nextToken();
		const consequence = this.parseExpression(Precedence.LOWEST);

		if (!this.expectPeek(TokenType.Else)) {
			this.addError(
				`Expected 'else' after then expression, got '${this.peekToken.lexeme}' instead.`,
				this.peekToken,
			);
			return {
				type: "IfExpression",
				condition,
				consequence,
				alternative: { type: "NumericLiteral", value: 0 },
			};
		}

		this.nextToken();
		const alternative = this.parseExpression(Precedence.LOWEST);

		return { type: "IfExpression", condition, consequence, alternative };
	}

	private parseNumericLiteral(): NumericLiteral {
		return {
			type: "NumericLiteral",
			value: this.currentToken.literal as number,
		};
	}

	private parseIdentifier(): Identifier {
		return {
			type: "Identifier",
			name: this.currentToken.lexeme,
		};
	}

	private parseGroupedExpression(): Expression {
		this.nextToken();
		const exp = this.parseExpression(Precedence.LOWEST);

		if (this.peekToken.type !== TokenType.RightParen) {
			this.addError(
				`Missing closing parenthesis ')'. Got '${this.peekToken.lexeme}' instead.`,
				this.peekToken,
			);
			return exp;
		}

		this.nextToken();
		return exp;
	}

	private peekPrecedence(): Precedence {
		return precedences[this.peekToken.type] || Precedence.LOWEST;
	}

	private currentPrecedence(): Precedence {
		return precedences[this.currentToken.type] || Precedence.LOWEST;
	}

	private expectPeek(tokenType: TokenType): boolean {
		if (this.peekToken.type === tokenType) {
			this.nextToken();
			return true;
		}
		return false;
	}
}
