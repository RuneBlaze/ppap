// src/dice/ast.ts

import type { Token } from "./tokens";

export type NodeType =
	| "Program"
	| "NumericLiteral"
	| "DiceRoll"
	| "BinaryOp"
	| "IfExpression"
	| "Identifier";

export interface Node {
	type: NodeType;
}

export interface Program extends Node {
	type: "Program";
	body: Statement[];
}

export type Statement = Expression;
export type Expression =
	| DiceRoll
	| BinaryOp
	| NumericLiteral
	| IfExpression
	| Identifier;

export interface NumericLiteral extends Node {
	type: "NumericLiteral";
	value: number;
}

export interface Identifier extends Node {
	type: "Identifier";
	name: string;
}

export interface DiceRoll extends Node {
	type: "DiceRoll";
	count: Expression;
	sides: Expression;
}

export interface BinaryOp extends Node {
	type: "BinaryOp";
	left: Expression;
	operator: Token;
	right: Expression;
}

export interface IfExpression extends Node {
	type: "IfExpression";
	condition: Expression;
	consequence: Expression;
	alternative: Expression;
}
