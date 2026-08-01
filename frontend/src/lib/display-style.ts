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

/**
 * 棚の並べ方。宮殿スタイルのときだけ効く従属設定。
 * rows    = 横長の棚を縦に積む（既定）
 * columns = 縦長の棚を横に並べる
 */
export type ShelfOrientation = 'rows' | 'columns'

export const SHELF_ORIENTATIONS: Record<ShelfOrientation, { label: string; description: string }> = {
  rows: { label: '横棚を縦に積む', description: '棚板を段に重ねる。1段ずつ横に流して見る' },
  columns: { label: '縦棚を横に並べる', description: '背の高い棚を並べる。棚ごとに上から見る' },
}

export const SHELF_ORIENTATION_KEYS = Object.keys(SHELF_ORIENTATIONS) as ShelfOrientation[]
export const DEFAULT_SHELF_ORIENTATION: ShelfOrientation = 'rows'

export const isShelfOrientation = (v: string | null | undefined): v is ShelfOrientation =>
  v === 'rows' || v === 'columns'
