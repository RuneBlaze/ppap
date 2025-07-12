import type {
	FSMConfig,
	FsmEvent,
	FsmState,
} from "../ui/state/GenericFocusStateMachine";

// 1. Define States
export type AnimationDemoFocusState =
	| (FsmState & { id: "idle" })
	| (FsmState & { id: "animationMenu" })
	| (FsmState & { id: "popupMenu" });

// 2. Define Events
export type AnimationDemoFocusEvent =
	| (FsmEvent & { type: "toggleAnimationMenu" })
	| (FsmEvent & { type: "togglePopupMenu" })
	| (FsmEvent & { type: "selectItem" }) // Generic event for closing menu on selection
	| (FsmEvent & { type: "close" });

// 3. Define the FSM configuration
export const animationDemoFocusConfig: FSMConfig<
	AnimationDemoFocusState,
	AnimationDemoFocusEvent
> = {
	initialState: { id: "idle" },
	transitions: [
		// Toggle Animation Menu
		{
			from: "idle",
			event: "toggleAnimationMenu",
			to: () => ({ id: "animationMenu" }),
		},
		{
			from: "animationMenu",
			event: "toggleAnimationMenu",
			to: () => ({ id: "idle" }),
		},
		{
			from: "popupMenu",
			event: "toggleAnimationMenu",
			to: () => ({ id: "animationMenu" }), // Switch from popup to anim menu
		},

		// Toggle Popup Menu
		{
			from: "idle",
			event: "togglePopupMenu",
			to: () => ({ id: "popupMenu" }),
		},
		{
			from: "popupMenu",
			event: "togglePopupMenu",
			to: () => ({ id: "idle" }),
		},
		{
			from: "animationMenu",
			event: "togglePopupMenu",
			to: () => ({ id: "popupMenu" }), // Switch from anim to popup menu
		},

		// Close from any menu state
		{
			from: ["animationMenu", "popupMenu"],
			event: "close",
			to: () => ({ id: "idle" }),
		},

		// Selecting an item from a menu closes it and returns to idle
		{
			from: ["animationMenu", "popupMenu"],
			event: "selectItem",
			to: () => ({ id: "idle" }),
		},
	],
};
