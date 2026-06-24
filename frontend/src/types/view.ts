import type { ItemMedia, GenerationStatus } from './item'
import type { CoverType, CoverImage } from './cover'

export interface View {
  id: string
  name: string
  view_type: string
  space_id?: string | null // space_map 種別の配置先スペース
  cover_type: CoverType
  cover_item_id: string | null
  cover: ItemMedia | null
  cover_images: ItemMedia[]
  cover_image: CoverImage | null
  created_at: string
}

// フリーボード上に配置されたカード（deck では position が順序を表す）
export interface ViewItemPlacement {
  item_id: string
  x: number
  y: number
  z_index: number
  position?: number | null
  item: {
    id: string
    title: string
    generation_status: GenerationStatus
    media: ItemMedia | null
  }
}

// space_map: スペースのポイント（loci）と、そこに配置されたカード
export interface SpaceMapPoint {
  space_point_id: string
  position: number
  name: string | null
  generation_status: GenerationStatus
  image: { url: string; thumb_url?: string } | null
  placed_item: {
    id: string
    title: string
    generation_status: GenerationStatus
    media: ItemMedia | null
  } | null
}

export interface ViewDetail extends View {
  items?: ViewItemPlacement[] // freeboard
  space?: { id: string; name: string; space_type: string } | null // space_map
  points?: SpaceMapPoint[] // space_map
}
