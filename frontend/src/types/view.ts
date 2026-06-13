import type { ItemMedia, GenerationStatus } from './item'

export interface View {
  id: string
  name: string
  view_type: string
  created_at: string
}

// フリーボード上に配置されたカード
export interface ViewItemPlacement {
  item_id: string
  x: number
  y: number
  z_index: number
  item: {
    id: string
    title: string
    generation_status: GenerationStatus
    media: ItemMedia | null
  }
}

export interface ViewDetail extends View {
  items: ViewItemPlacement[]
}
