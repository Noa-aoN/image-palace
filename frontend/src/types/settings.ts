export interface UserSettings {
  auto_generate_meanings: boolean
  auto_generate_tags: boolean
  /** 新規カードのデフォルト画像スタイル（"" はおまかせ）。STYLE_OPTIONS の value と一致 */
  default_image_style: string
  locale: string
  timezone: string
}
