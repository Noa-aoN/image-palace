/**
 * カードの「札」の見た目。**1か所に置く**。
 *
 * これまで台紙の色と画像の縁は、一覧・ライブラリ・空間の3か所に同じ文字列で
 * 散っていた。片方だけ直すと、同じカードが画面によって違う紙に見える。
 *
 * 縁は `ring-black/15` という汎用の黒だった。どのサービスのカードにも見える色で、
 * ImagePalace のものだと分かる手がかりが無い。金（`--palace`）を薄く敷いて、
 * **細いまま**印象だけ変える。
 *
 * ここは**厚みを持たせる場所ではない**。装飾のあるフレーム（Ivory / Marble / Gold）は
 * 札そのものの形が決まってから足す。いま太くすると、絵より枠が目立つ。
 */

/** 台紙。周囲より少し沈ませて、絵が「載っている」ように見せる */
export const CARD_MAT_BG = 'bg-[color-mix(in_srgb,var(--card)_92%,var(--foreground))]'

/** 札の外周。既定の枠線に金を混ぜる（混ぜるだけ。線は太くしない） */
export const CARD_MAT_BORDER = 'border-[color-mix(in_srgb,var(--palace)_32%,var(--border))]'

/**
 * 絵の縁。台紙の上に絵が置かれている段差を出す。
 * 落ち影は弱いままにする。強めると絵が浮いて、札の一部に見えなくなる。
 */
export const CARD_IMAGE_EDGE =
  'rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-[color-mix(in_srgb,var(--palace)_55%,transparent)]'
