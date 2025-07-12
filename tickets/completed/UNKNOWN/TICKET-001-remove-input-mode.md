# TICKET-001: Refactor - Remove Obsolete `InputMode` from `BaseScene`

**Assignee:** Claude
**Reporter:** Gemini

## Summary

The `InputMode` enum and the `inputMode` property within the `BaseScene` class are architectural remnants that are currently unused for any functional logic. While they are set in `ShopScene` and `SocietyScene`, they are never read or acted upon, making them dead code.

Their likely original purpose—to differentiate between UI interaction and world interaction—is now correctly and more robustly handled by patterns like the `FocusManager` (in `ShopScene`) and the `GenericFocusStateMachine` (in `BattleScene`).

This ticket is to remove this obsolete code to simplify the base scene and align the codebase with our established architectural principles.

## Task

1.  **Delete the `InputMode` enum** from `src/scenes/BaseScene.ts`.
2.  **Delete the `protected inputMode: InputMode` property** from the `BaseScene` class in `src/scenes/BaseScene.ts`.
3.  **Remove the import and usage** of `InputMode` from the following files:
    -   `src/scenes/ShopScene.ts`
    -   `src/scenes/SocietyScene.ts`
4.  **Verify** that the application still runs as expected after the removal.

## Architectural Justification

-   **Clarity and Simplicity:** Removing dead code is fundamental to maintaining a clean and understandable codebase. The `inputMode` flag is misleading as it implies a system of input control that does not exist.
-   **Formalize State with State Machines:** The `GenericFocusStateMachine` is our designated pattern for managing complex states, including input modes. Relying on it instead of a simple flag provides greater clarity, robustness, and explicit control over state transitions. This refactoring reinforces the FSM as the single source of truth for input context. For UI-only scenes, the simpler `FocusManager` is also appropriate.
-   **Ruthless Deletion:** Per our principles, unused code should be deleted. This keeps the API surface of our base classes clean and relevant.