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

export interface SpacePoint {
  id: string
  position: number
  item: SpacePointCard | null
}

export interface SpaceDetail extends Space {
  collections?: SpaceCollectionRef[] // room 種別
  points?: SpacePoint[] // road 種別
}
