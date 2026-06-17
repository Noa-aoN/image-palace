import type { ItemMedia, GenerationStatus } from './item'

export interface Space {
  id: string
  name: string
  description: string | null
  space_type: string
  created_at: string
}

// room 種別: 並べるコレクションの軽量表現
export interface SpaceCollectionRef {
  id: string
  name: string
  description: string | null
  entry_count: number
}

// road 種別: 序数ポイント（カード未割当なら item は null）
export interface SpacePointCard {
  id: string
  title: string
  generation_status: GenerationStatus
  media: ItemMedia | null
}

// ポイント自身の生成画像（ポイント名から生成）
export interface SpacePointImage {
  url: string
  thumb_url?: string
}

export interface SpacePoint {
  id: string
  position: number
  name: string | null
  generation_status: GenerationStatus
  generation_error?: string | null
  x: number // room 種別の間取り配置座標
  y: number
  image: SpacePointImage | null // ポイント名から生成した画像
  item: SpacePointCard | null // 割り当てたカード（任意）
}

export interface SpaceDetail extends Space {
  collections?: SpaceCollectionRef[] // room 種別（コレクション棚・暫定）
  points?: SpacePoint[] // road / room 種別の loci ポイント
}
