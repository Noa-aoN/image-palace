// 一覧の見せ方。ユーザーが選ぶのは「シンプル」か「宮殿スタイル」かの 2 択だけ。
// 宮殿スタイルのときに何を出すかは「場（surface）」ごとに決まるので、
// 場が増えても設定項目は増えない。
export type DisplayStyle = 'simple' | 'palace'

export const DISPLAY_STYLES: Record<DisplayStyle, { label: string; description: string }> = {
  palace: {
    label: '宮殿スタイル',
    description: '場に合わせた見せ方（ライブラリは棚、アトリエは制作台など）',
  },
  simple: {
    label: 'シンプル',
    description: '装飾のない一覧。情報量を優先する',
  },
}

export const DISPLAY_STYLE_KEYS = Object.keys(DISPLAY_STYLES) as DisplayStyle[]
export const DEFAULT_DISPLAY_STYLE: DisplayStyle = 'palace'

/** 場。宮殿スタイルのときの器（棚・制作台・机）を決める */
export type Surface = 'library' | 'atelier' | 'study'

export const isDisplayStyle = (v: string | null | undefined): v is DisplayStyle =>
  v === 'simple' || v === 'palace'
