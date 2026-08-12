import type { KeyboardEvent } from 'react'

/**
 * 入力欄の Enter を「決定」として扱ってよいか。
 *
 * **日本語を打つ人にとって、Enter は2度押すもの**。
 * 1度目は変換の確定、2度目でようやく決定になる。
 * 変換中の Enter を拾うと、「宮殿」と打とうとしただけで
 * 「きゅうでん」のまま保存されてしまう。
 *
 * `isComposing` は、変換中かどうかをブラウザが教えてくれる印。
 * React の合成イベントには乗っていないので、`nativeEvent` から見る。
 *
 * keyCode 229 も併せて見るのは、古い Safari が変換中に
 * `isComposing` を立てないことがあるため。
 */
export function isSubmitEnter(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter') return false
  if (event.nativeEvent.isComposing) return false
  // 変換中を表す約束事の値。isComposing を立てない実装への備え
  if (event.nativeEvent.keyCode === 229) return false

  return true
}

/**
 * 「変換中でなければ決定する」を1行で書けるようにする。
 *
 *   onKeyDown={onEnter(() => save())}
 */
export function onEnter(handler: () => void) {
  return (event: KeyboardEvent) => {
    if (!isSubmitEnter(event)) return

    event.preventDefault()
    handler()
  }
}
