import type { ItemMedia } from './item'

export interface SearchCard {
  id: string
  title: string
  media: ItemMedia | null
}

export interface SearchDeck {
  id: string
  name: string
  item_count: number
  cover: ItemMedia | null
}

export interface SearchNamed {
  id: string
  name: string
}

export interface SearchResults {
  items: SearchCard[]
  decks: SearchDeck[]
  boxes: (SearchNamed & { entry_count: number })[]
  spaces: SearchNamed[]
  views: SearchNamed[]
}
