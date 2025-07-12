import type { Character } from "@/ui/components/AllyStatusPanel";

export enum ActionType {
	ATTACK = "attack",
	DEFEND = "defend",
	SKILL = "skill",
	ITEM = "item",
}

export interface BattleCharacter extends Character {
	speed: number;
	isPlayer: boolean;
	selectedAction?: BattleAction;
}

export interface BattleAction {
	type: ActionType;
	skillId?: string;
	itemId?: string;
	targetId?: string;
	damage?: number;
	healing?: number;
}

export interface ActionDefinition {
	id: string;
	name: string;
	type: ActionType;
	iconFrame: number;
	skillId?: string;
	mpCost?: number;
	damage?: number;
	healing?: number;
}

export interface Skill {
	id: string;
	name: string;
	mpCost: number;
	damage?: number;
	healing?: number;
	description: string;
}
