import type { ItemMedia } from './item'
import type { CoverType, CoverImage } from './cover'

export interface Collection {
  id: string
  name: string
  description: string | null
  entry_count: number
  cover_type: CoverType
  cover_item_id: string | null
  cover: ItemMedia | null
  cover_images: ItemMedia[]
  cover_image: CoverImage | null
  created_at: string
}

export type CollectionEntryType = 'Item' | 'Deck' | 'Space' | 'View'

// コレクションにまとめられた要素（カード/デッキ/スペース/ビューの混在）
export type CollectionEntry =
  | { entry_type: 'Item'; id: string; title: string; media: ItemMedia | null }
  | { entry_type: 'Deck'; id: string; name: string; item_count: number; cover: ItemMedia | null }
  | { entry_type: 'Space'; id: string; name: string }
  | { entry_type: 'View'; id: string; name: string }

export interface CollectionDetail extends Collection {
  entries: CollectionEntry[]
}
