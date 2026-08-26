/**
 * 覆いの濃さ。
 *
 * **掛けるかどうか（`image_safeguard`）とは別の軸。**
 * 「細部が読めない／構図は掴める」の境目は、絵の中身と、見る人と、
 * その場（人前かどうか）で変わる。**3つの段に丸めると、ちょうどよい所が段の間に落ちる。**
 *
 * 0 が最も薄く、100 が最も濃い。既定の 50 は、段で持っていたころの「標準」と同じ見え方。
 */

export const MIN_LEVEL = 0
export const MAX_LEVEL = 100
export const DEFAULT_LEVEL = 50

/**
 * 目盛り → 実際の掛かり方。
 *
 * ぼかしは 6px（かすかに霞む）から 42px（色の気配だけ）まで。
 * 40px を超えると何の絵かも分からなくなるので、そこを上限にしている。
 *
 * 拡大は**ぼかしから決める**。縁のぼけを枠の外へ押し出すためのもので、
 * 強くぼかすほど広く要る（別々に決めると、強い所で角に地が見える）。
 *
 * 霞と網も一緒に上げる。ぼかしだけ強くしても、直視の圧は下がらない。
 */
export function safeguardLook(level?: number | null) {
  const v = clampLevel(level)
  const blur = 6 + v * 0.36

  return {
    blur,
    scale: 1 + blur / 240,
    wash: 0.1 + v * 0.0032,
    mesh: 0.04 + v * 0.0006,
  }
}

/** 範囲の外や、読めない値は既定へ倒す。**覆いが外れてはいけない** */
export function clampLevel(level?: number | null): number {
  if (typeof level !== 'number' || Number.isNaN(level)) return DEFAULT_LEVEL

  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)))
}

/**
 * 覆っている絵に当てる style。
 *
 * **クラスにできない。** Tailwind はクラス名を文字列として静的に読むので、
 * 目盛りから作った値（`blur(23.4px)`）はクラスにならない。
 * ここは値が動くので、インラインで持つのが正しい。
 */
export function safeguardImageStyle(level?: number | null): React.CSSProperties {
  const look = safeguardLook(level)

  return {
    filter: `blur(${look.blur.toFixed(1)}px) saturate(1.2)`,
    transform: `scale(${look.scale.toFixed(3)})`,
  }
}

/**
 * 覆っている絵に当てる class。
 *
 * 掴んで引きずられるのを止める保険だけを持つ。
 * 引きずりはブラウザが**元の画像そのもの**を持ち上げるので、
 * ぼかしを外した絵が指の下に出てしまう。呼び出し側の `draggable={false}` と両方掛ける。
 */
export const SAFEGUARD_IMAGE_CLASS = 'select-none [-webkit-user-drag:none]'

/**
 * 目盛りに付ける呼び名。**数字だけでは、どのくらいなのかが分からない。**
 * 段の名前は無くさず、目盛りの読み方として残す。
 */
export function safeguardLabel(level?: number | null): string {
  const v = clampLevel(level)
  if (v <= 33) return '薄い'
  if (v <= 66) return '標準'
  return '濃い'
}
