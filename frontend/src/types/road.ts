import type { ItemMedia, GenerationStatus } from './item'

export interface Road {
  id: string
  space_id: string
  name: string
  position: number | null
  point_count: number
  created_at: string
}

export interface RoadPointCard {
  id: string
  title: string
  generation_status: GenerationStatus
  media: ItemMedia | null
}

// ロード上の序数ポイント（カード未割当なら item は null）
export interface RoadPoint {
  id: string
  position: number
  item: RoadPointCard | null
}

export interface RoadDetail extends Road {
  points: RoadPoint[]
}
