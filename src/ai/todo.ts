import { tool } from "ai";
import { z } from "zod";

// Todo state management
interface TodoItem {
	id: number;
	body: string;
	completed: boolean;
	createdAt: Date;
}

/**
 * Factory function to create a todo tool with encapsulated state.
 * @param initialTodos Optional array of strings to initialize the todo list
 */
export function createTodoTool(initialTodos?: string[]) {
	// Encapsulated state using closure
	let todos: TodoItem[] = [];
	let currentFocusIndex = 0;
	let nextId = 1;

	// Initialize with provided todos if any
	if (initialTodos && initialTodos.length > 0) {
		todos = initialTodos
			.filter((body) => body && body.trim() !== "") // Filter out empty strings
			.map((body, _index) => ({
				id: nextId++,
				body: body.trim(),
				completed: false,
				createdAt: new Date(),
			}));

		// Set focus to first todo if we have any
		currentFocusIndex = todos.length > 0 ? 0 : 0;
	}

	// Helper functions with access to closure state
	function formatTodoList(): string {
		if (todos.length === 0) {
			return "No todos found.";
		}

		const lines: string[] = [];
		lines.push("Todo List:");
		lines.push("----------");

		todos.forEach((todo, index) => {
			const status = todo.completed ? "✓" : " ";
			const focused = index === currentFocusIndex ? "👉" : "  ";
			const prefix = `${focused}[${status}]`;
			lines.push(`${prefix} ${index + 1}. ${todo.body}`);
		});

		lines.push("");
		lines.push(`Focus: ${currentFocusIndex + 1}/${todos.length}`);

		return lines.join("\n");
	}

	function adjustFocusAfterChange(): void {
		if (todos.length === 0) {
			currentFocusIndex = 0;
		} else if (currentFocusIndex >= todos.length) {
			currentFocusIndex = todos.length - 1;
		} else if (currentFocusIndex < 0) {
			currentFocusIndex = 0;
		}
	}

	// Return the tool with access to closure state
	return tool({
		description:
			"Manage todo items with list, complete, create, and delete operations. Maintains focus on current item. Designed for AI task tracking.",
		inputSchema: z.object({
			action: z
				.enum(["list", "complete", "create", "delete"])
				.describe("The action to perform"),
			body: z
				.string()
				.optional()
				.describe("Todo body text (for create action)"),
			insertIndex: z
				.number()
				.optional()
				.describe("Index to insert at (for create action, 1-based)"),
			deleteIndex: z
				.number()
				.optional()
				.describe("Index to delete (for delete action, 1-based)"),
		}),
		execute: async ({ action, body, insertIndex, deleteIndex }) => {
			switch (action) {
				case "list":
					console.log("list", formatTodoList());
					return {
						action: "list",
						result: formatTodoList(),
						totalTodos: todos.length,
						focusIndex: currentFocusIndex + 1,
						completedCount: todos.filter((t) => t.completed).length,
						pendingCount: todos.filter((t) => !t.completed).length,
					};

				case "complete": {
					if (todos.length === 0) {
						return {
							action: "complete",
							result: "No todos to complete.",
							totalTodos: 0,
							focusIndex: 0,
							completedCount: 0,
							pendingCount: 0,
						};
					}

					const currentTodo = todos[currentFocusIndex];
					if (currentTodo.completed) {
						return {
							action: "complete",
							result: `Todo "${currentTodo.body}" is already completed.`,
							list: formatTodoList(),
							totalTodos: todos.length,
							focusIndex: currentFocusIndex + 1,
							completedCount: todos.filter((t) => t.completed).length,
							pendingCount: todos.filter((t) => !t.completed).length,
						};
					}

					// Mark as completed
					currentTodo.completed = true;

					// Move focus to next incomplete todo
					let nextFocus = currentFocusIndex + 1;
					while (nextFocus < todos.length && todos[nextFocus].completed) {
						nextFocus++;
					}

					// If no incomplete todos after current, look from the beginning
					if (nextFocus >= todos.length) {
						nextFocus = 0;
						while (
							nextFocus < currentFocusIndex &&
							todos[nextFocus].completed
						) {
							nextFocus++;
						}
					}

					// If all todos are completed, stay on the last one
					if (nextFocus >= todos.length || todos[nextFocus].completed) {
						nextFocus = currentFocusIndex;
					}

					currentFocusIndex = nextFocus;

					return {
						action: "complete",
						result: `Completed: "${currentTodo.body}"`,
						list: formatTodoList(),
						totalTodos: todos.length,
						focusIndex: currentFocusIndex + 1,
						completedCount: todos.filter((t) => t.completed).length,
						pendingCount: todos.filter((t) => !t.completed).length,
					};
				}

				case "create": {
					if (!body || body.trim() === "") {
						return {
							action: "create",
							result:
								"Error: body is required for create action and cannot be empty.",
							totalTodos: todos.length,
							focusIndex: currentFocusIndex + 1,
							completedCount: todos.filter((t) => t.completed).length,
							pendingCount: todos.filter((t) => !t.completed).length,
						};
					}

					const newTodo: TodoItem = {
						id: nextId++,
						body: body.trim(),
						completed: false,
						createdAt: new Date(),
					};

					// Determine insertion point
					let insertAt = insertIndex ? insertIndex - 1 : todos.length; // Convert to 0-based
					insertAt = Math.max(0, Math.min(insertAt, todos.length));

					todos.splice(insertAt, 0, newTodo);

					// Adjust focus if insertion point affects it
					if (insertAt <= currentFocusIndex) {
						currentFocusIndex++;
					}

					adjustFocusAfterChange();

					return {
						action: "create",
						result: `Created todo: "${body.trim()}" at position ${insertAt + 1}`,
						list: formatTodoList(),
						totalTodos: todos.length,
						focusIndex: currentFocusIndex + 1,
						completedCount: todos.filter((t) => t.completed).length,
						pendingCount: todos.filter((t) => !t.completed).length,
					};
				}

				case "delete": {
					if (!deleteIndex || deleteIndex < 1) {
						return {
							action: "delete",
							result:
								"Error: deleteIndex is required for delete action and must be a positive number.",
							totalTodos: todos.length,
							focusIndex: currentFocusIndex + 1,
							completedCount: todos.filter((t) => t.completed).length,
							pendingCount: todos.filter((t) => !t.completed).length,
						};
					}

					const deleteAt = deleteIndex - 1; // Convert to 0-based
					if (deleteAt < 0 || deleteAt >= todos.length) {
						return {
							action: "delete",
							result: `Error: Invalid index ${deleteIndex}. Must be between 1 and ${todos.length}.`,
							list: formatTodoList(),
							totalTodos: todos.length,
							focusIndex: currentFocusIndex + 1,
							completedCount: todos.filter((t) => t.completed).length,
							pendingCount: todos.filter((t) => !t.completed).length,
						};
					}

					const deletedTodo = todos[deleteAt];
					todos.splice(deleteAt, 1);

					// Adjust focus if deletion affects it
					if (deleteAt < currentFocusIndex) {
						currentFocusIndex--;
					} else if (deleteAt === currentFocusIndex) {
						// If we deleted the focused item, keep the same index but adjust if needed
						adjustFocusAfterChange();
					}

					return {
						action: "delete",
						result: `Deleted todo: "${deletedTodo.body}"`,
						list: formatTodoList(),
						totalTodos: todos.length,
						focusIndex: currentFocusIndex + 1,
						completedCount: todos.filter((t) => t.completed).length,
						pendingCount: todos.filter((t) => !t.completed).length,
					};
				}

				default:
					return {
						action: "unknown",
						result: `Unknown action: ${action}`,
						totalTodos: todos.length,
						focusIndex: currentFocusIndex + 1,
						completedCount: todos.filter((t) => t.completed).length,
						pendingCount: todos.filter((t) => !t.completed).length,
					};
			}
		},
	});
}
