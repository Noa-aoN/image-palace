/**
 * デッキの見せ方（リスト / カード）。
 *
 * **端末に覚えさせる。** どう見たいかは読む人の都合で、デッキの性質ではない。
 * サーバーに持たせると、並びを直したい人と中身を読みたい人が
 * 同じデッキを取り合うことになる。
 *
 * 読めないとき（プライベートウィンドウ・site data を止めている等）は
 * 既定へ落ちる。覚えられないことを理由に画面を出さない。
 */
export type DeckLayout = 'list' | 'card'

const KEY = 'deck-layout'
export const DEFAULT_DECK_LAYOUT: DeckLayout = 'list'

export function readDeckLayout(): DeckLayout {
  try {
    return localStorage.getItem(KEY) === 'card' ? 'card' : DEFAULT_DECK_LAYOUT
  } catch {
    return DEFAULT_DECK_LAYOUT
  }
}

export function writeDeckLayout(layout: DeckLayout): void {
  try {
    localStorage.setItem(KEY, layout)
  } catch {
    // 覚えられなくても、その場の切り替えは効く
  }
}
