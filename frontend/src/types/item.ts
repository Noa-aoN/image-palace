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
  /** セーフガードの承認待ちか。true の間は覆いを掛けて出す */
  needs_approval?: boolean
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

/** カード1枚にぶら下がる意味・説明の1件。代表の1件は Item.meaning にも入る */
export interface ItemMeaning {
  id: string
  definition: string
  example_sentence?: string | null
  detail_level: string
  /** 何を書いた文か（意味 / 説明 / 解説 / 翻訳 / 原義） */
  kind?: string
  language_code: string
  position: number | null
  fact_check_status?: 'correct' | 'doubtful' | 'incorrect' | null
  fact_check_comment?: string | null
  fact_check_suggestion?: string | null
  fact_checked_at?: string | null
  fact_check_acknowledged_at?: string | null
}

import type { ItemPropertyEntry } from '@/lib/api/properties'

export interface Item {
  // カード画像の縦横比（square / portrait / golden）
  aspect_ratio?: string
  id: string
  title: string
  generation_status: GenerationStatus
  generation_error?: string | null
  /**
   * そのまま作り直して直り得るか。false は「入力を変えないかぎり同じ結果になる」失敗。
   * 押しても必ず失敗するので、作り直しの導線を出さない
   */
  generation_retryable?: boolean
  item_type?: ItemType | null
  /** 代表の1件（日本語優先→並び順の先頭）。複数を扱う画面は meanings を見る */
  meaning?: string | null
  meaning_example?: string | null
  meaning_level?: string | null
  /** 並び順どおりの全件 */
  meanings?: ItemMeaning[]
  /** その種別で定義されている項目（未入力のものも含む） */
  properties?: ItemPropertyEntry[]
  /** このカードだけの見え方（隠すブロック・並び順） */
  /**
   * このカード1枚の見え方。
   * omitted = そのカードでは持たない項目（− のエリア）
   * hidden  = 持っているが、いまは畳んでいる項目
   */
  block_view?: {
    hidden: string[]
    order: string[]
    omitted?: string[]
    /** 札ごとの幅（何列ぶんを占めるか）。書いていないものは1列 */
    spans?: Record<string, number>
    /** 列への振り分けを自動にするか。書いていなければ自動 */
    auto_flow?: boolean
    /** 自分で決めるときの、列ごとの個数（左から順） */
    column_counts?: number[]
    /** 既定のひな型を当てた結果か。true なら order に無いものは「持たない」扱い */
    from_preset?: boolean
  }
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
  /** 人が読んで判断した日時。入っていれば一覧でも警告色を出さない */
  fact_check_acknowledged_at?: string | null
  style?: string | null
  /** 構図（'' = おまかせ / single = 単体 / scene = 情景） */
  framing?: string | null
  /** 画像への指示の作り方（word / brief / research） */
  prompt_source?: string | null
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
  /** 一覧で名前として出す文字列。設定した項目に値があればそれ、無ければ title と同じ */
  headline?: string
  /** 一覧のカードに、名前と絵のほかに出す項目。値の無いものは入らない */
  list_fields?: { key: string; label: string; value: string }[]
  /** 絵を作るモデル。null は「おまかせ」＝そのときの既定 */
  image_model?: string | null
  created_at: string
}
