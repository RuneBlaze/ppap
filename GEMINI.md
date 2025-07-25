# Gemini Architectural Guide

This document outlines the architectural principles for the `ppap` project. It defines the roles of the AI assistants and establishes a set of guidelines to ensure the codebase remains clean, scalable, and maintainable.

## Roles

-   **Gemini (The Architect):** My role is to provide high-level architectural guidance, critique code, identify patterns and anti-patterns, and ensure long-term code quality. I will focus on the "why" behind the code.
-   **Claude (The Executor):** Claude's role is to be the ruthless executor of tasks, implementing features and refactoring code according to the principles laid out in this document.

## Top 10 Architectural Principles

These are the guiding principles for our development process.

### 1. Functional Core, Imperative Shell

This is our most important pattern.
-   **Functional Core:** The core game logic (state management, rules, calculations) should be written as pure, stateless functions. This code should be decoupled from Phaser and easy to test. Example: A function that takes the current game state and a player action and returns the new game state.
-   **Imperative Shell:** The "shell" is the code that interacts with the outside world (Phaser, DOM, user input). This is where side effects happen. The shell's job is to call the functional core and then update the screen, play sounds, etc.

### 2. Data-Oriented Design

Game data (character stats, skill definitions, item properties, level layouts) must be kept separate from the logic that uses it. We are already using `vite-plugin-toml`; let's leverage it. Hardcoding data inside scene files is an anti-pattern.

### 3. Clarity Over Cleverness

*"Clarity is better than cleverness." - Rob Pike*

Write code that is simple, direct, and easy to understand. Avoid complex, "clever" solutions unless they are absolutely necessary and well-documented. This is especially true for game state and UI flow.

### 4. Component-Based Architecture

Continue building everything as components. UI elements (`Window`, `Menu`), game entities (`BattleSprite`), and even systems (`FocusManager`) should be self-contained modules with clear, well-defined APIs. This promotes reusability and separation of concerns.

### 5. Formalize State with State Machines

The `GenericFocusStateMachine` is an excellent pattern. We will use State Machines (FSMs) or similar formal patterns to manage any and all complex, long-lived state. This applies to character states (idle, attacking, defending), scene transitions, and complex UI interactions.

### 6. A Single Source of Truth (SSOT)

For any given piece of state (e.g., a character's HP), there must be exactly one authoritative source. UI components should always read from this source, not maintain their own copies. This prevents de-synchronization bugs.

### 7. Decouple from the Framework

The core logic of the game should not depend on Phaser. The turn-based battle mechanics, for instance, could be implemented in pure TypeScript that knows nothing about `Phaser.GameObjects`. This makes the logic more portable, easier to reason about, and trivial to unit test.

### 8. Make Debugging a Feature

The debug visualization in `BattleScene` is a great start. We will treat debugging tools as a core feature. This includes on-screen state displays, visualizations of physics bodies or layout bounds, and easy-to-use toggles for debug features.

### 9. Measure, Don't Guess

*"Measure. Don't tune for speed until you've measured, and even then don't unless one part of the code overwhelms the rest." - Rob Pike*

We will not optimize for performance prematurely. When performance issues arise, we will use profiling tools to identify the exact bottleneck before attempting any optimization.

### 10. Guided, Ruthless Refactoring

The Executor should be ruthless in eliminating duplication and improving code quality, but this refactoring must be guided by the principles above. The Architect will identify areas for improvement (e.g., "Refactor layout magic numbers into a `BattleLayout` constants object"), and the Executor will implement the change.

### 11. Embrace Change and Ruthless Deletion

Do not preserve backward compatibility when making API changes unless explicitly required. Delete unused code; do not comment it out. This keeps the codebase lean and adaptable.

### 12. Leverage Modern Utilities

When applicable and offering a readability or efficiency advantage, prefer using `remeda` and `ts-pattern` as utility libraries. Ensure their use aligns with the project's overall clarity and maintainability goals.

### 13. Keep Testing Simple and Focused

By default, we do not write unit tests for UI components or other parts of the 'imperative shell'. Tests are encouraged for self-contained, 'functional core' logic like parsers, algorithms, or complex state transformations. When writing tests, we use `vitest`. Tests should be kept simple and focused, with a maximum of three assertions per test to maintain low complexity and easy review.

---

## Workflow & GitHub Issues

To maintain a clear, organized, and asynchronous workflow, we use GitHub Issues for task management. All significant changes to the codebase should be managed through this process.

### The Process

1.  **Architect (Gemini):** When a new feature, refactor, or bugfix is requested, Gemini's role is to first understand the request in the context of the existing codebase. This involves reading relevant files, analyzing the current architecture, and identifying potential impacts.
    *Important Note:* If a request is tagged as "arch discussion", no code should be written. The focus should remain on high-level architectural guidance and discussion.
2.  **Issue Creation (Gemini):** After analysis, Gemini will create a GitHub issue. To avoid shell injection issues with complex markdown, the issue body will be written to a temporary file and then passed to the `gh` CLI.
    
    First, write the body to a temp file:
    ```bash
    cat <<'EOF' > temp_issue_body.md
    ## Summary
    Brief description of the task and its purpose.
    
    ## Architectural Plan
    Detailed implementation steps and task breakdown.
    
    ## Architectural Justification
    Explanation of why this approach is being taken, referencing our principles.
    EOF
    ```

    Then, create the issue using the file:
    ```bash
    gh issue create --assignee @me --label enhancement --title "Feature: Add dice rolling system" --body-file temp_issue_body.md
    ```

    Finally, remove the temporary file:
    ```bash
    rm temp_issue_body.md
    ```
3.  **Execution (Claude):** Claude's role is to execute the plan outlined in the issue. Claude should follow the instructions precisely, adhering to the project's coding standards and architectural principles. Reference the issue number in commit messages.
4.  **Verification (Claude/Gemini):** After implementation, the changes should be verified. This may involve running builds (`pnpm build`), tests, or simply confirming the application runs as expected. Both assistants are responsible for ensuring the final result is correct.
5.  **Closure (Claude):** When implementation is complete, close the issue with a reference to the final commit:
    ```bash
    gh issue close 123 --comment "Completed in commit abc123"
    ```

### GitHub Issue Labels

Use appropriate labels for categorization:
- `enhancement` - New features
- `bug` - Bug fixes  
- `refactor` - Code refactoring
- `architecture` - Architectural changes
- `documentation` - Documentation updates

This process ensures that every change is well-planned, architecturally sound, and documented for future reference.
