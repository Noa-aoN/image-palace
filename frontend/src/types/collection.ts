import type { Item } from './item'

export interface Collection {
  id: string
  name: string
  description: string | null
  item_count: number
  created_at: string
}

export interface CollectionDetail extends Collection {
  items: Item[]
}
