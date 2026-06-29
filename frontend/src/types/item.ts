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
  /** LQIP プレースホルダ（極小 WebP の data URL）。読み込み中のぼかし表示用 */
  blur?: string
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
  /** 説明のAIファクトチェック結果 */
  fact_check_status?: 'correct' | 'doubtful' | 'incorrect' | null
  fact_check_comment?: string | null
  /** doubtful/incorrect 時の訂正案（説明の書き換え候補） */
  fact_check_suggestion?: string | null
  /** 単語名自体の訂正案（取り違え・誤記など） */
  fact_check_title_suggestion?: string | null
  fact_checked_at?: string | null
  style?: string | null
  custom_prompt?: string | null
  tags?: ItemTag[]
  media: ItemMedia | null
  created_at: string
}
