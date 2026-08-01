export type DiagramMode = '2d' | '3d'
export type MotionMode = 'auto' | 'on' | 'off'

export interface UserSettings {
  auto_generate_meanings: boolean
  auto_generate_tags: boolean
  /** 新規カードのデフォルト画像スタイル（"" はおまかせ）。STYLE_OPTIONS の value と一致 */
  default_image_style: string
  // 新規カードの既定の縦横比（square / portrait / golden）
  default_aspect_ratio: string
  /** 再生成時に「意味・説明を参考にする」の既定値（既定 ON） */
  regenerate_with_meaning: boolean
  /** 図（間取り図・記憶資産など）の表現。既定 "3d" */
  diagram_mode: DiagramMode
  /** アニメーションの扱い。"auto" は端末（OS）の設定に従う。既定 "auto" */
  motion_mode: MotionMode
  locale: string
  timezone: string
}
