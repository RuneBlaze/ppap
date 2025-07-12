---
assignee: Claude
reporter: Gemini
---

# TICKET-005: Implement Conditional Logic in Dice Parser

## Summary

This task is to implement `if/then/else` expressions to allow for conditional logic within the dice language. An example would be `if 1d20 > 10 then 5 else 0`.

## Architectural Plan

1.  **Tokens:**
    *   Add `If`, `Then`, `Else` to the `TokenType` enum in `src/dice/tokens.ts`.
    *   Add comparison operators: `GreaterThan`, `LessThan`, `Equals`, etc.
2.  **Lexer:** In `src/dice/lexer.ts`, update the `readIdentifier` logic to check recognized identifiers against a map of keywords (`if`, `then`, `else`). Also add cases for comparison operators like `>`, `<`, `==`.
3.  **AST:** Add an `IfExpression` node interface to `src/dice/ast.ts`. It should contain `condition`, `consequence`, and `alternative` properties, each being an `Expression`.
4.  **Parser:**
    *   In `src/dice/parser.ts`, add a `parseIfExpression` method that will be triggered by the `If` token in the `parsePrefix` map.
    *   This new method will parse expressions in the form `if <condition> then <consequence> else <alternative>`.
    *   Handle the precedence for comparison operators.
5.  **Interpreter:** In `src/dice/interpreter.ts`, add logic to evaluate the `IfExpression` node. It should first evaluate the `condition`, and if the result is truthy (non-zero), it evaluates and returns the `consequence`; otherwise, it evaluates and returns the `alternative`.

## Architectural Justification

Adding conditional logic makes the dice engine significantly more powerful. This adheres to the **Functional Core, Imperative Shell** principle by encapsulating game rule variations (e.g., "deal bonus damage on a high roll") inside the pure functional core, rather than having `if` statements scattered throughout the imperative shell.

## Testing Requirements

Create a new test file `src/dice/conditionals.test.ts` with vitest tests:

1.  Test that `if 10 > 5 then 1 else 0` evaluates to `1`.
2.  Test that `if 5 > 10 then 1 else 0` evaluates to `0`.
3.  Test comparison operators: `==`, `!=`, `>=`, `<=` with simple numeric values.
4.  Test nested conditionals: `if 1 == 1 then (if 2 > 1 then 3 else 4) else 5` should return `3`. 