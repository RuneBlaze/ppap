---
assignee: Claude
reporter: Gemini
---

# TICKET-004: Add Parentheses Support to Dice Parser

## Summary

This task is to add support for `()` to group expressions in the dice language. This will allow overriding the default operator precedence, enabling more complex calculations like `(1d6 + 2) * 3`.

## Architectural Plan

1.  **Lexer:** Update `src/dice/lexer.ts` to recognize `(` and `)` characters, producing `LeftParen` and `RightParen` tokens respectively.
2.  **Parser:**
    *   In `src/dice/parser.ts`, modify the `parsePrefix` method. When a `LeftParen` token is encountered, it should call `parseExpression` recursively to handle the nested expression.
    *   The precedence for this new grouped expression should be `Precedence.LOWEST`.
    *   After parsing the inner expression, the parser must expect and consume a `RightParen` token. If it's not found, throw a specific error.
3.  **Testing:** Add test cases to `examples/dice-parser-example.ts` to validate the new functionality.

## Architectural Justification

This feature directly supports the **Clarity Over Cleverness** principle by allowing expression grouping that is explicit and easy to read. It's a fundamental feature for any language involving arithmetic and is crucial for building more complex game mechanics.

## Testing Requirements

Please add two minimal test cases to `examples/dice-parser-example.ts`:

1.  One test for a simple precedence override, like `(2 + 3) * 4`. Assert that the result is `20`.
2.  One test combining dice and parentheses, like `(1d4 + 1) * 2`. Assert that the result is a number.

Keep the tests simple and focused on the new functionality. 