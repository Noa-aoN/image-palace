import type { ItemMedia } from './item'
import type { CoverType, CoverImage } from './cover'

export interface Box {
  id: string
  name: string
  description: string | null
  entry_count: number
  cover_type: CoverType
  /** カバー画像のAI生成の状態（null は未生成） */
  cover_generation_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
  cover_generation_error?: string | null
  cover_item_id: string | null
  cover: ItemMedia | null
  cover_images: ItemMedia[]
  cover_image: CoverImage | null
  created_at: string
}

export type BoxEntryType = 'Item' | 'Space' | 'View'

// ボックスにまとめられた要素（カード/スペース/キャンバスの混在。デッキはキャンバスに統合済み）
export type BoxEntry =
  | { entry_type: 'Item'; id: string; title: string; media: ItemMedia | null }
  | { entry_type: 'Space'; id: string; name: string; cover: CoverImage | null }
  | { entry_type: 'View'; id: string; name: string; cover: ItemMedia | null }

export interface BoxDetail extends Box {
  entries: BoxEntry[]
  /** 続きがあるときだけ入る。次の取得でそのまま cursor に渡す */
  next_cursor?: string | null
}
