---
assignee: Claude
reporter: Gemini
---

# TICKET-006: Add Evaluation Context Support

## Summary

This task is to enable the dice evaluator to accept a "context" object. This will allow expressions to include variables that are resolved at runtime, such as character stats (e.g., `1d8 + STR`).

## Architectural Plan

1.  **AST:** The `Identifier` node in `src/dice/ast.ts` is already defined, so no changes are needed there.
2.  **Parser:** The `Parser` in `src/dice/parser.ts` already produces `Identifier` tokens. We need to add a `parseIdentifier` method to its prefix parsing map to handle variable names in expressions.
3.  **Interpreter:**
    *   In `src/dice/interpreter.ts`, modify the `Interpreter.eval` and its helper methods to accept an optional `context: Record<string, number>` argument.
    *   When the interpreter encounters an `Identifier` node, it must look up the identifier's name in the provided context object.
    *   If the name exists in the context, return its value.
    *   If the name does not exist, throw a clear runtime error (e.g., "Unknown variable: STR").
4.  **API:** Update the main `evaluate` function in `src/dice/index.ts` to accept the optional context and pass it down to the interpreter.

## Architectural Justification

This change is critical for achieving **Data-Oriented Design** and **Decoupling from the Framework**. The game's core logic (e.g., `BattleScene`) can now pass its state (character stats) as plain data to the dice parser, which remains a pure, self-contained system. This avoids hardcoding stats and makes the parser highly reusable.

## Testing Requirements

Create a new test file `src/dice/context.test.ts` with vitest tests:

1.  Test variable lookup: evaluate `"2 + MIGHT"` with context `{ MIGHT: 4 }` should return `6`.
2.  Test missing variable: evaluate `"STR + 1"` with empty context should throw error containing "Unknown variable: STR".
3.  Test dice with variables: evaluate `"1d6 + BONUS"` with context `{ BONUS: 3 }` should return a number >= 4 and <= 9.
4.  Test multiple variables: evaluate `"STR + DEX"` with context `{ STR: 10, DEX: 14 }` should return `24`. 