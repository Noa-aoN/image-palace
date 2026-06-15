import type { Item, ItemMedia } from './item'

export type DeckCoverType = 'first_card' | 'collage' | 'custom'

export interface DeckCoverImage {
  url: string
  thumb_url: string
}

export interface Deck {
  id: string
  name: string
  item_count: number
  cover_type: DeckCoverType
  cover_item_id: string | null
  cover: ItemMedia | null
  // first_card（先頭切替）/ collage 用のカード画像（順序付き）
  cover_images: ItemMedia[]
  // custom モードのアップロード画像
  cover_image: DeckCoverImage | null
  created_at: string
}

export interface DeckDetail extends Deck {
  items: Item[]
}
