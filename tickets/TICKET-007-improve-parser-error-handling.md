---
assignee: Claude
reporter: Gemini
---

# TICKET-007: Improve Parser Error Handling

## Summary

This task is to improve the quality of error messages produced by the parser. Instead of generic messages like "no prefix parse function found", errors should be specific, actionable, and include location information (line and column).

## Architectural Plan

1.  **Lexer:**
    *   Update the `Lexer` in `src/dice/lexer.ts` to track its current line and column number as it consumes the input string.
    *   The `Token` interface in `src/dice/tokens.ts` should be updated to include optional `line` and `col` properties.
2.  **Parser:**
    *   Refactor the `Parser`'s error handling. Instead of pushing simple strings to the `errors` array, it should push structured error objects (e.g., `{ message: string, line: number, col: number }`).
    *   Improve specific parsing methods. For example, the `parseInfixExpression` for a `Dice` token should validate that the right-hand side is a number and provide a clear error if it isn't.
    *   The `parsePrefix` method should be updated to provide a better error message for unexpected tokens.

## Architectural Justification

This work directly supports the **Make Debugging a Feature** principle. A powerful dice language is only useful if it's easy to debug. By providing clear, specific error messages, we make the system more robust and easier for designers and developers to work with, reducing frustration and development time.

## Testing Requirements

Create a new test file `src/dice/error-handling.test.ts` with vitest tests:

1.  Test incomplete dice expression `"3d"` should return errors with descriptive message and line/column info.
2.  Test mismatched parenthesis `"(5 + 2"` should return error about missing closing parenthesis.
3.  Test invalid token `"3 & 4"` should return error about unexpected character with location.
4.  Test valid expressions should return empty errors array.
5.  Verify error objects contain `message`, `line`, and `col` properties. 