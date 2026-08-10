export type DiagramMode = '2d' | '3d'
export type MotionMode = 'auto' | 'on' | 'off'

/** カードが持つ項目のひな型。keys はブロックのキー（prop:xxx を含む） */
export interface CardPropertyPreset {
  name: string
  keys: string[]
}

export interface UserSettings {
  auto_generate_meanings: boolean
  auto_generate_tags: boolean
  /** 新規カードのデフォルト画像スタイル（"" はおまかせ）。STYLE_OPTIONS の value と一致 */
  default_image_style: string
  // 新規カードの既定の縦横比（square / portrait / golden）
  default_aspect_ratio: string
  // 一覧の見せ方（simple / palace）
  display_style: string
  shelf_orientation: string
  /** ライブラリの棚の並び順。空配列を送ると既定の順に戻る */
  library_order: string[]
  /** 単語生成の既定の難しさ（easy / normal / hard / expert） */
  word_difficulty: string
  // 初回の表示スタイル確認を済ませたか
  onboarded: boolean
  /** 再生成時に「意味・説明を参考にする」の既定値（既定 ON） */
  regenerate_with_meaning: boolean
  /** 生成された絵に覆いを掛けて、承認するまで直視しないで済むようにする。既定 OFF */
  image_safeguard: boolean
  /** カード一覧で名前として出す項目の識別名。空なら見出し語（title） */
  card_headline_key: string | null
  /** カードが持つ項目のひな型 */
  card_property_presets: CardPropertyPreset[]
  /** 新しいカードに最初から当てるひな型の名前。空なら当てない */
  default_card_preset: string | null
  /** 一覧のカードに、名前と絵のほかに出す項目の識別名 */
  card_list_fields: string[]
  /** 追加できる項目の上限（サーバー側の決め） */
  max_card_list_fields: number
  /** 図（間取り図・記憶資産など）の表現。既定 "3d" */
  diagram_mode: DiagramMode
  /** アニメーションの扱い。"auto" は端末（OS）の設定に従う。既定 "auto" */
  motion_mode: MotionMode
  locale: string
  timezone: string
}
