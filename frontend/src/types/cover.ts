import type { ItemMedia } from './item'

// カバー（ヘッダー）設定。デッキ/ボックス/スペース/キャンバス共通。
export type CoverType = 'first_card' | 'collage' | 'custom'

// custom カバー画像 / スペースのポイント画像（url/thumb_url を持つ最小形）
export interface CoverImage {
  url: string
  thumb_url?: string
}

// シリアライズされたカバー画像（カード由来は ItemMedia、ポイント由来は CoverImage）
export type CoverMedia = ItemMedia | CoverImage
