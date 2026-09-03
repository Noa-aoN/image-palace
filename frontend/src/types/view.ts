import type { Item, ItemMedia, GenerationStatus } from './item'
import type { CoverType, CoverImage } from './cover'

// freeboard: ボード全体設定
export interface BoardSettings {
  bg_color?: string
  bg_pattern?: 'dots' | 'grid' | 'none'
  pattern_color?: string // 背景模様（ドット/グリッド線）の色
  card_font_size?: number // カードの単語文字サイズ(px)
  /**
   * カード内の画像の見せ方。
   * cover（既定）はカードいっぱいに広げて切り取る。縦横比の違うカードが並ぶと
   * 見えている範囲がまちまちになるので、揃えたいときは contain（全景を収める）。
   */
  card_image_fit?: 'cover' | 'contain'
  minimap?: boolean
  controls?: boolean
}

export interface View {
  id: string
  name: string
  view_type: string
  space_id?: string | null // space_map 種別の配置先スペース
  cover_type: CoverType
  /** カバー画像のAI生成の状態（null は未生成） */
  cover_generation_status?: 'pending' | 'processing' | 'completed' | 'failed' | null
  cover_generation_error?: string | null
  cover_item_id: string | null
  cover: ItemMedia | null
  cover_images: ItemMedia[]
  cover_image: CoverImage | null
  settings?: BoardSettings // freeboard のボード設定
  background_image?: { url: string } | null // freeboard の背景画像
  /** 置いてあるカードの数。一覧でのみ返る */
  item_count?: number
  created_at: string
}

// ボード上に配置されたカード（deck では position が順序を表す）
export interface ViewItemPlacement {
  item_id: string
  x: number
  y: number
  z_index: number
  // freeboard カードのサイズ。null はクライアント既定サイズ。
  width?: number | null
  height?: number | null
  position?: number | null
  /**
   * 置いてあるカード。**デッキだけは一覧と同じ札の形で返る**
   * （headline / list_fields / tags など）。板や空間は絵と名前しか出さない
   */
  item: DeckPlacementItem
}

/**
 * 置いてあるカード。
 *
 * **必ずあるのは、絵と名前を出すのに要るものだけ。**
 * デッキのときは一覧と同じ札に足りるものまで返るが、
 * 板や空間では返らないので、全部そろっている型にはできない。
 */
export type DeckPlacementItem = Partial<Item> & {
  id: string
  title: string
  generation_status: GenerationStatus
  media: ItemMedia | null
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
export type EdgeMarker = 'none' | 'arrow'

// freeboard: 接続線の手動折れ点（フロー座標）
export interface EdgePoint {
  x: number
  y: number
}

/** 線の種類。dashed（旧・真偽値）から移行中で、未指定なら dashed を見る */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted' | 'double'

/** 折れ点のつなぎ方。角ばる／角を丸める／全体をなめらかに */
export type EdgeCurve = 'sharp' | 'round' | 'smooth'

export interface ViewEdgeStyle {
  color?: string
  /** @deprecated line_style を使う。既存データのために読み続ける */
  dashed?: boolean
  line_style?: EdgeLineStyle
  /** 折れ点があるときのつなぎ方（既定 sharp） */
  curve?: EdgeCurve
  /** 角を丸める大きさ(px)。curve='round' のときだけ効く */
  curve_radius?: number
  width?: number // 線の太さ(px)
  opacity?: number // 線の不透明度(0-100)
  marker_start?: EdgeMarker // 始端の形（既定 none）
  marker_end?: EdgeMarker // 終端の形（既定 arrow）
  label_color?: string // ラベルの文字色
  label_size?: number // ラベルの文字サイズ(px)
  label_bg?: string // ラベルの背景色（空=なし）
  label_opacity?: number // ラベルの不透明度(0-100)
  label_vertical?: boolean // ラベルを縦書きにする
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
  points?: EdgePoint[] | null // 手動折れ点（空=自動ルーティング）
  z_index?: number // 重なり順（大きいほど手前）
}

// AI編集のモード。placed_only=いまある札だけ / select=手持ちから探して足す
export type AiEditMode = 'placed_only' | 'select'

/** AI に整えてもらうときの方針（ボードのみ） */
export type AiEditLayout = 'auto' | 'hierarchy' | 'radial' | 'flow' | 'grid'
export type AiEditEdgeMode = 'rebuild' | 'keep' | 'infer' | 'restyle' | 'relabel'
export type AiEditSizeMode = 'ai' | 'uniform' | 'keep'
export type AiEditPlacementMode = 'arrange' | 'keep'

export interface AiEditOptions {
  layout?: AiEditLayout
  edges?: AiEditEdgeMode
  sizing?: AiEditSizeMode
  placement?: AiEditPlacementMode
}

/** 「カードから作る」の提案（まだ作られていない） */
export interface CardProposal {
  title: string
  reason: string | null
}

/** 手持ちから図に組み込むカード（作らないのでクレジットは要らない） */
export interface CardReuse {
  id: string
  title: string
  reason: string | null
}

/** 図のつながり。承認前に見せ、作成後の配置にも渡す */
export interface CardEdge {
  from: string
  to: string
  label: string | null
}

export interface CardProposalResult {
  proposals: CardProposal[]
  reuse: CardReuse[]
  edges: CardEdge[]
  /** ボードのとき、これから作る完成図の説明 */
  plan: string | null
  /** 上限で切り詰めたか */
  truncated: boolean
  /** 1回に提案できる上限 */
  max_count: number
  available_credits: number
}

// AI編集で何が変わったか
export interface AiEditSummary {
  summary: string
  /** AIが気づいた点（誤りや不足の指摘）。無いこともある */
  notes?: string | null
  added: number
  removed: number
  placed: number
  connected: number
}

export interface ViewDetail extends View {
  /** 「カードから作る」で作られたぶん（その応答にだけ入る） */
  created_cards?: { count: number; titles: string[]; reused: number; arranged: boolean }
  items?: ViewItemPlacement[] // freeboard
  edges?: ViewEdge[] // freeboard
  space?: { id: string; name: string; space_type: string } | null // space_map
  points?: SpaceMapPoint[] // space_map
  /** AI編集の直後だけ返る（何が変わったかの報告） */
  ai_edit?: AiEditSummary
  /** 戻る／進むの可否 */
  revision?: { cursor: number; can_undo: boolean; can_redo: boolean }
  /**
   * 一覧の並べ方（デッキのときだけ返る）。
   * **カードごとではなくキャンバスに1回**（全カードで同じ設定のため）
   */
  card_list?: { blocks: string[]; image: boolean; type_mark: boolean }
}
