import type { ItemMedia } from './item'

export interface Collection {
  id: string
  name: string
  description: string | null
  deck_count: number
  created_at: string
}

// コレクションに束ねられたデッキの軽量表現
export interface CollectionDeck {
  id: string
  name: string
  item_count: number
  cover: ItemMedia | null
}

export interface CollectionDetail extends Collection {
  decks: CollectionDeck[]
}
