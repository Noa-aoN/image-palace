/**
 * 覆いの濃さ。
 *
 * **掛けるかどうか（`image_safeguard`）とは別の軸。**
 * 「細部が読めない／構図は掴める」の境目は人によって違う。
 * 不意打ちを避けたいだけの人には薄いほうがよく、
 * 人前で開く人には色の気配すら残さないほうがよい。
 *
 * `normal` が従来の見え方（ぼかし 24px）。既定を変えないので、
 * いままでの利用者の見え方はそのまま。
 */
export type SafeguardStrength = 'light' | 'normal' | 'strong'

export const SAFEGUARD_STRENGTHS: { key: SafeguardStrength; label: string; hint: string }[] = [
  { key: 'light', label: '薄い', hint: '何の絵かは分かる程度に留めます' },
  { key: 'normal', label: '標準', hint: '細部は読めず、構図は掴めます' },
  { key: 'strong', label: '濃い', hint: '色の気配だけを残します' },
]

/**
 * 濃さごとの見た目。
 *
 * ぼかしは**画像側**、霞と網は**覆い側**に掛かる。2つで1つの見え方なので、
 * ここで対にして持つ（別々に持つと、片方だけ強くして辻褄が合わなくなる）。
 *
 * 拡大は縁のぼけを枠の外へ押し出すため（縮むと角に地が見える）。
 * 強くぼかすほど縁も広がるので、拡大も一緒に上げる。
 */
const LOOKS: Record<SafeguardStrength, { image: string; wash: number; mesh: number }> = {
  // 12px は「人物か風景か」に加えて、何が写っているかまで伝わる強さ
  light: { image: 'blur-[12px] scale-105 saturate-110', wash: 0.16, mesh: 0.05 },
  // 24px が従来の見え方。**ここは動かさない**
  normal: { image: 'blur-[24px] scale-110 saturate-125', wash: 0.26, mesh: 0.07 },
  // 40px は色の気配しか残らない。「何の絵か」は分からなくなる
  strong: { image: 'blur-[40px] scale-125 saturate-125', wash: 0.38, mesh: 0.1 },
}

/** 知らない値は標準に倒す。サーバーが先に進んでいても、覆いが外れてはいけない */
export function safeguardLook(strength?: string | null) {
  const key = (SAFEGUARD_STRENGTHS.find((s) => s.key === strength)?.key ?? 'normal') as SafeguardStrength
  return LOOKS[key]
}

/**
 * 覆っている絵に当てる class。
 *
 * `select-none` と `-webkit-user-drag` は、掴んで引きずられるのを止める保険。
 * 引きずりはブラウザが**元の画像そのもの**を持ち上げるので、
 * ぼかしを外した絵が指の下に出てしまう。呼び出し側の `draggable={false}` と両方掛ける。
 */
export function safeguardImageClass(strength?: string | null): string {
  return `${safeguardLook(strength).image} select-none [-webkit-user-drag:none]`
}
