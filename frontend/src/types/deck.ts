import type { Item, ItemMedia } from './item'

export interface Deck {
  id: string
  name: string
  item_count: number
  cover_item_id: string | null
  cover: ItemMedia | null
  created_at: string
}

export interface DeckDetail extends Deck {
  items: Item[]
}
