import type { ItemMedia, GenerationStatus } from './item'
import type { CoverType, CoverImage } from './cover'

export interface Space {
  id: string
  name: string
  description: string | null
  space_type: string
  // room の寸法（メートル相当。3D の箱・2D の各面アスペクトに反映）
  width: number
  depth: number
  height: number
  point_scale: number // ポイント表示サイズの共通倍率
  // カバー（カバー候補はポイントの生成画像。表紙は SpacePoint を指定）
  cover_type: CoverType
  cover_space_point_id: string | null
  cover: CoverImage | null
  cover_images: CoverImage[]
  cover_image: CoverImage | null
  created_at: string
}

// room 種別: 並べるボックスの軽量表現
export interface SpaceBoxRef {
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
  /** LQIP プレースホルダ（極小 WebP の data URL） */
  blur?: string
}

// 多面ルームの面（床・天井・4壁）
export type RoomSurface = 'floor' | 'ceiling' | 'wall_north' | 'wall_east' | 'wall_south' | 'wall_west'

export interface SpacePoint {
  id: string
  position: number
  name: string | null
  generation_status: GenerationStatus
  generation_error?: string | null
  x: number // room 種別の旧・間取り配置座標（surface/u/v へ移行中。当面併存）
  y: number
  surface: RoomSurface // 点が属する面
  u: number // 面内の正規化座標 (0..1)
  v: number
  scale: number // ポイント個別の表示倍率（0.3..3）
  image: SpacePointImage | null // ポイント名から生成した画像
  item: SpacePointCard | null // 割り当てたカード（任意）
}

export interface SpaceDetail extends Space {
  boxes?: SpaceBoxRef[] // room 種別（ボックス棚・暫定）
  points?: SpacePoint[] // road / room 種別の loci ポイント
}
