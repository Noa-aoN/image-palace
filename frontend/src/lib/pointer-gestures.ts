/**
 * 押す・動かす・続けて押す を見分ける小さな判定。
 *
 * ルームの点は 2D（RoomCanvas）と 3D（Room3D）の両方で掴めるが、
 * 押し方の約束が食い違うと使う人が混乱する。しきい値も判定も
 * ここ1か所に置いて、両方から使う。
 */

/**
 * 続けて押したら「開く」とみなす間隔（ミリ秒）。
 *
 * OS の既定（500ms 前後）より短くしている。ルームでは同じ点を置き直すために
 * ゆっくり2回掴むことがあり、そこで設定が開くと邪魔になるため。
 */
export const DOUBLE_PRESS_MS = 350

/**
 * これ未満の動きは「押しただけ」とみなす遊び（ピクセル）。
 *
 * 掴んで離すだけでも数ピクセルは動くので、0 にすると
 * ただ選んだだけのときにも座標を書き戻してしまう。
 */
export const DRAG_THRESHOLD_PX = 4

export type PressRecord = { id: string; at: number } | null

/**
 * 直前の記録と今回の押下から、続けて2回押したか（＝開く操作か）を判定する。
 * 別の点を押したときは、間隔が短くても続きとはみなさない。
 */
export function isDoublePress(last: PressRecord, id: string, at: number): boolean {
  if (!last || last.id !== id) return false

  const elapsed = at - last.at
  // 時刻が巻き戻る（別系統のタイムスタンプが混ざる）ことがあっても、続きとは扱わない
  if (elapsed < 0) return false

  return elapsed < DOUBLE_PRESS_MS
}

/** 押した位置から離した位置まで、動いたと言えるだけ動いたか */
export function movedEnough(startX: number, startY: number, endX: number, endY: number): boolean {
  return Math.hypot(endX - startX, endY - startY) >= DRAG_THRESHOLD_PX
}
