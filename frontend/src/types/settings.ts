export interface UserSettings {
  auto_generate_meanings: boolean
  auto_generate_tags: boolean
  /** 新規カードのデフォルト画像スタイル（"" はおまかせ）。STYLE_OPTIONS の value と一致 */
  default_image_style: string
  /** 再生成時に「意味・説明を参考にする」の既定値（既定 ON） */
  regenerate_with_meaning: boolean
  locale: string
  timezone: string
}
