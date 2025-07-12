import type {
	BinaryOp,
	DiceRoll,
	Identifier,
	IfExpression,
	Node,
	NumericLiteral,
	Program,
} from "./ast";
import { TokenType } from "./tokens";

export interface RollResult {
	total: number;
	rolls: number[];
}

export type EvaluationResult = number | RollResult;

export class Interpreter {
	public eval(
		node: Node,
		context?: Record<string, number>,
	): EvaluationResult | EvaluationResult[] {
		if (this.isProgram(node)) {
			const results = node.body.map((stmt) =>
				this.evaluateNode(stmt as Node, context),
			);
			// If there's only one statement, don't wrap it in an array.
			return results.length === 1 ? results[0] : results;
		}
		return this.evaluateNode(node, context);
	}

	private evaluateNode(
		node: Node,
		context?: Record<string, number>,
	): EvaluationResult {
		if (this.isBinaryOp(node)) {
			const left = this.asNumber(this.evaluateNode(node.left, context));
			const right = this.asNumber(this.evaluateNode(node.right, context));
			switch (node.operator.type) {
				case TokenType.Plus:
					return left + right;
				case TokenType.Minus:
					return left - right;
				case TokenType.Multiply:
					return left * right;
				case TokenType.Divide:
					return Math.floor(left / right); // Integer division
				case TokenType.Equals:
					return left === right ? 1 : 0;
				case TokenType.NotEquals:
					return left !== right ? 1 : 0;
				case TokenType.GreaterThan:
					return left > right ? 1 : 0;
				case TokenType.LessThan:
					return left < right ? 1 : 0;
				case TokenType.GreaterThanOrEqual:
					return left >= right ? 1 : 0;
				case TokenType.LessThanOrEqual:
					return left <= right ? 1 : 0;
			}
		}
		if (this.isDiceRoll(node)) {
			const count = this.asNumber(this.evaluateNode(node.count, context));
			const sides = this.asNumber(this.evaluateNode(node.sides, context));

			if (count <= 0 || sides <= 0) {
				throw new Error("Number of dice and sides must be positive.");
			}

			const rolls: number[] = [];
			let total = 0;
			for (let i = 0; i < count; i++) {
				const roll = Math.floor(Math.random() * sides) + 1;
				rolls.push(roll);
				total += roll;
			}
			return { total, rolls };
		}
		if (this.isNumericLiteral(node)) {
			return node.value;
		}
		if (this.isIfExpression(node)) {
			const conditionValue = this.asNumber(
				this.evaluateNode(node.condition, context),
			);
			if (conditionValue !== 0) {
				return this.evaluateNode(node.consequence, context);
			} else {
				return this.evaluateNode(node.alternative, context);
			}
		}
		if (this.isIdentifier(node)) {
			if (!context || !(node.name in context)) {
				throw new Error(`Unknown variable: ${node.name}`);
			}
			return context[node.name];
		}

		throw new Error(`Unknown node type: ${node.type}`);
	}

	private asNumber(result: EvaluationResult): number {
		if (typeof result === "number") {
			return result;
		}
		return result.total;
	}

	private isProgram(node: Node): node is Program {
		return node.type === "Program";
	}
	private isBinaryOp(node: Node): node is BinaryOp {
		return node.type === "BinaryOp";
	}
	private isNumericLiteral(node: Node): node is NumericLiteral {
		return node.type === "NumericLiteral";
	}
	private isDiceRoll(node: Node): node is DiceRoll {
		return node.type === "DiceRoll";
	}
	private isIfExpression(node: Node): node is IfExpression {
		return node.type === "IfExpression";
	}
	private isIdentifier(node: Node): node is Identifier {
		return node.type === "Identifier";
	}
}
