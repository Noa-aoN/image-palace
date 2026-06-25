export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface MediaGenerationInfo {
  provider?: string
  model?: string
  quality?: string
  size?: string
  revised_prompt?: string | null
}

export interface ItemMedia {
  id: string
  url: string
  thumb_url?: string
  media_type: string
  /** 画像生成時のメタ情報（モデル・revised_prompt 等）。無い場合あり */
  generation_info?: MediaGenerationInfo | null
}

export interface ItemType {
  id: string
  name: string
  label: string
}

export interface ItemTag {
  id: string
  name: string
}

export interface Item {
  id: string
  title: string
  generation_status: GenerationStatus
  generation_error?: string | null
  item_type?: ItemType | null
  meaning?: string | null
  meaning_example?: string | null
  meaning_level?: string | null
  style?: string | null
  custom_prompt?: string | null
  tags?: ItemTag[]
  media: ItemMedia | null
  created_at: string
}
