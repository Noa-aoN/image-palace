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
  // freeboard カードのサイズ。null はクライアント既定サイズ。
  width?: number | null
  height?: number | null
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

// freeboard: カード間の接続線（フローチャート）のスタイル
export interface ViewEdgeStyle {
  color?: string
  dashed?: boolean
  width?: number // 線の太さ(px)
  opacity?: number // 線の不透明度(0-100)
  label_color?: string // ラベルの文字色
  label_size?: number // ラベルの文字サイズ(px)
  label_bg?: string // ラベルの背景色（空=なし）
  label_opacity?: number // ラベルの不透明度(0-100)
}

// freeboard: カード間の接続線。source/target は文字列ノード id（カードは item_id）。
export interface ViewEdge {
  id: string
  source: string
  target: string
  source_handle?: string | null
  target_handle?: string | null
  label?: string | null
  style?: ViewEdgeStyle | null
}

export interface ViewDetail extends View {
  items?: ViewItemPlacement[] // freeboard
  edges?: ViewEdge[] // freeboard
  space?: { id: string; name: string; space_type: string } | null // space_map
  points?: SpaceMapPoint[] // space_map
}
