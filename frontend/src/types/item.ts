export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** 画像の下ごしらえ（説明文・情景プロンプト）の状態。none は未作成・機能オフ */
export type BriefStatus = 'none' | 'pending' | 'processing' | 'completed' | 'failed'

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

/** 説明文から取り出した主張ひとつと、その検証結果 */
export interface FactCheckClaim {
  text: string
  /** supported=裏づけあり / unsupported=確証なし / contradicted=矛盾 */
  verdict: 'supported' | 'unsupported' | 'contradicted'
  note?: string
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
  // カード画像の縦横比（square / portrait / golden）
  aspect_ratio?: string
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
  /** 説明文を読む前に、AIがその語について独立に確認できたこと */
  fact_check_known?: string | null
  /** 説明文から取り出した主張ごとの検証結果 */
  fact_check_claims?: FactCheckClaim[]
  fact_checked_at?: string | null
  style?: string | null
  custom_prompt?: string | null
  /** ① 画像を作る前に単語を噛み砕いた説明文（日本語） */
  image_description?: string | null
  /** ② ①から起こした情景プロンプト（英語）。画像生成にそのまま渡る */
  scene_prompt?: string | null
  brief_status?: BriefStatus
  /** ユーザーが①②を手で直したか。直したものは自動生成で上書きされない */
  brief_edited?: boolean
  tags?: ItemTag[]
  media: ItemMedia | null
  created_at: string
}
