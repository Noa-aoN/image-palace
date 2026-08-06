// カード画像の縦横比。バックエンドの AspectRatios と対応させる。
// 種類が増えたらここへ 1 行足せば、表示・選択 UI の両方に反映される。
export type AspectRatioKey = 'square' | 'portrait' | 'golden' | 'golden_landscape'

export const ASPECT_RATIOS: Record<AspectRatioKey, { label: string; css: string; note?: string }> = {
  square: { label: '正方形', css: '1 / 1' },
  portrait: { label: '縦長', css: '2 / 3' },
  // 生成 API が直接出せないため、近い比で生成してから切り出している（試験導入）。
  // golden は縦のまま据え置く（既存カードの保存済み画像が縦のため）。横は別キー。
  golden: { label: '黄金比（縦）', css: '1 / 1.618', note: '試験' },
  golden_landscape: { label: '黄金比（横）', css: '1.618 / 1', note: '試験' },
}

export const ASPECT_RATIO_KEYS = Object.keys(ASPECT_RATIOS) as AspectRatioKey[]
export const DEFAULT_ASPECT_RATIO: AspectRatioKey = 'square'

const isKey = (v: string | null | undefined): v is AspectRatioKey =>
  !!v && (ASPECT_RATIO_KEYS as string[]).includes(v)

/** 画像枠に渡す CSS の aspect-ratio 値。未知の値は既定に倒す */
export function aspectRatioCss(key: string | null | undefined): string {
  return ASPECT_RATIOS[isKey(key) ? key : DEFAULT_ASPECT_RATIO].css
}
