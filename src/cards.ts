// Card definitions for the roguelike deckbuilder

export interface Card {
  id: string
  name: string
  description: string
  cost: number
  artIndex: number // Index in the card art spritesheet
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  type: 'attack' | 'defend' | 'skill' | 'power'
  damage?: number
  shield?: number
  effects?: string[]
}

// Example card definitions
export const exampleCards: Card[] = [
  {
    id: 'strike',
    name: 'Strike',
    description: 'Deal 6 damage.',
    cost: 1,
    artIndex: 0,
    rarity: 'common',
    type: 'attack',
    damage: 6
  },
  {
    id: 'defend',
    name: 'Defend',
    description: 'Gain 5 Block.',
    cost: 1,
    artIndex: 1,
    rarity: 'common',
    type: 'defend',
    shield: 5
  },
  {
    id: 'fire_blast',
    name: 'Fire Blast',
    description: 'Deal 12 damage.',
    cost: 2,
    artIndex: 2,
    rarity: 'uncommon',
    type: 'attack',
    damage: 12
  },
  {
    id: 'ice_barrier',
    name: 'Ice Barrier',
    description: 'Gain 8 Block. Draw a card.',
    cost: 2,
    artIndex: 3,
    rarity: 'uncommon',
    type: 'defend',
    shield: 8,
    effects: ['draw_card']
  },
  {
    id: 'lightning_storm',
    name: 'Lightning Storm',
    description: 'Deal 8 damage to ALL enemies.',
    cost: 3,
    artIndex: 4,
    rarity: 'rare',
    type: 'attack',
    damage: 8,
    effects: ['target_all']
  },
  {
    id: 'healing_potion',
    name: 'Healing Potion',
    description: 'Restore 15 HP.',
    cost: 1,
    artIndex: 5,
    rarity: 'common',
    type: 'skill',
    effects: ['heal_15']
  },
  {
    id: 'power_up',
    name: 'Power Up',
    description: 'Gain +2 Strength for the rest of combat.',
    cost: 1,
    artIndex: 6,
    rarity: 'uncommon',
    type: 'power',
    effects: ['gain_strength_2']
  },
  {
    id: 'meteor',
    name: 'Meteor',
    description: 'Deal 20 damage. Costs 1 less for each card played this turn.',
    cost: 4,
    artIndex: 7,
    rarity: 'legendary',
    type: 'attack',
    damage: 20,
    effects: ['cost_reduction']
  }
]

// Utility functions for cards
export function getCardCost(card: Card): number {
  return card.cost
}

export function getCardsByRarity(cards: Card[], rarity: Card['rarity']): Card[] {
  return cards.filter(card => card.rarity === rarity)
}

export function getCardsByType(cards: Card[], type: Card['type']): Card[] {
  return cards.filter(card => card.type === type)
} 