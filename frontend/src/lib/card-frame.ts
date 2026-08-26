/**
 * カードの「札」の見た目。**1か所に置く**。
 *
 * これまで台紙の色と画像の縁は、一覧・ライブラリ・空間の3か所に同じ文字列で
 * 散っていた。片方だけ直すと、同じカードが画面によって違う紙に見える。
 *
 * 縁は `ring-black/15` という汎用の黒だった。どのサービスのカードにも見える色で、
 * IMAGE PALACE のものだと分かる手がかりが無い。金（`--palace`）を薄く敷いて、
 * **細いまま**印象だけ変える。
 *
 * ここは**厚みを持たせる場所ではない**。装飾のあるフレーム（Ivory / Marble / Gold）は
 * 札そのものの形が決まってから足す。いま太くすると、絵より枠が目立つ。
 */

/**
 * 台紙。
 *
 * **灰で沈ませない。** `--foreground` を混ぜていたころは、青みのある灰になり、
 * ivory の地の上では紙ではなく汚れに見えた。カード詳細のプロパティ枠と同じ
 * 暖かい白（`--surface-warm`）に揃える。同じカードなのに、一覧と詳細で
 * 紙の色が違う状態をなくす。
 */
export const CARD_MAT_BG = 'bg-[var(--surface-warm)]'

/**
 * 札の外周。詳細の器と同じ金の縁（`--edge-gold`）にする。
 *
 * 既定の枠線に金を混ぜる形だと、混ぜ先の灰が勝って、ほとんど灰の線に見えていた。
 * 線は太くしない。太くすると絵より枠が目立つ
 */
export const CARD_MAT_BORDER = 'border-[var(--edge-gold)]'

/**
 * 絵の縁。台紙の上に絵が置かれている段差を出す。
 * 落ち影は弱いままにする。強めると絵が浮いて、札の一部に見えなくなる。
 */
export const CARD_IMAGE_EDGE =
  'rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-[color-mix(in_srgb,var(--palace)_55%,transparent)]'

/**
 * カード詳細の項目を載せる器（`PropertyBlock`）の地と縁。
 *
 * **札と同じ紙にする。** 一覧の札（`CARD_MAT_BG`）と詳細の器で紙の色が違うと、
 * 同じカードなのに画面ごとに別のものに見える。値はどちらも `--surface-warm`。
 *
 * 縁だけ一段薄い（`--edge-gold-soft`）。内側の器のほうが強いと主従が逆になる。
 *
 * ここに出しておくのは、**カードの見た目をまとめて作り直すときに、
 * 触る場所を1か所にするため**。詳細をノートの形にするなら、変えるのはここになる。
 */
export const BLOCK_SURFACE = 'var(--surface-warm)'
export const BLOCK_BORDER = 'ring-1 ring-[var(--edge-gold-soft)]'
export const BLOCK_RADIUS = 'rounded-xl'

/**
 * まだ何も書いていない器の地。**書いたものと見分けるために落とす。**
 *
 * `--ivory-dark` では ivory との差が 8/10/14 しかなく、「少し暗い紙」に
 * しか見えなかった。一段落として灰へ寄せてある。
 */
export const BLOCK_SURFACE_EMPTY = 'var(--surface-empty)'
