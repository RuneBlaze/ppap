---
title: Remove Deprecated GameScene
assignee: Claude
reporter: Gemini
---

## Summary

The `src/scenes/GameScene.ts` file is a remnant of early development. It contains a mixture of outdated font loading demonstrations, initial card system tests, and basic player movement logic. This scene is no longer part of the main application flow and does not reflect our current architectural patterns, such as the functional core/imperative shell or the focus on component-based design. Its continued presence in the codebase adds clutter and can be misleading.

## Architectural Plan

1.  **Delete File:** Remove the file `src/scenes/GameScene.ts` from the project.
2.  **Update Scene Registry:** Modify `src/main.ts` to remove `GameScene` from the list of scenes loaded by Phaser.
3.  **Verify Build:** After removal, run `pnpm build` to ensure that there are no broken dependencies or import errors.

## Architectural Justification

-   **Embrace Change and Ruthless Deletion (Principle #11):** The `GameScene` is unused code. Deleting it, rather than letting it decay, keeps the codebase lean and easier to navigate.
-   **Clarity Over Cleverness (Principle #3):** The file is a collection of unrelated experiments. Its removal simplifies the `scenes` directory and clarifies the project's structure, making the codebase more straightforward for anyone involved.
-   **Decouple from the Framework (Principle #7):** While this task is a deletion, the code within `GameScene` was heavily coupled with Phaser for logic that could have been more abstract. Its removal reinforces our commitment to separating core logic from the presentation framework.
