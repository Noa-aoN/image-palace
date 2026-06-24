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

export type CollectionEntryType = 'Item' | 'Space' | 'View'

// コレクションにまとめられた要素（カード/スペース/ビューの混在。デッキはビューに統合済み）
export type CollectionEntry =
  | { entry_type: 'Item'; id: string; title: string; media: ItemMedia | null }
  | { entry_type: 'Space'; id: string; name: string; cover: CoverImage | null }
  | { entry_type: 'View'; id: string; name: string; cover: ItemMedia | null }

export interface CollectionDetail extends Collection {
  entries: CollectionEntry[]
}
