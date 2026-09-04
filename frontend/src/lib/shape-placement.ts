/**
 * 図形をどこに、どの大きさで置くか。
 *
 * ## なぜ「引いて作る」のか
 *
 * これまでは、種類を選んだ瞬間に**画面の中央へ既定の大きさ**で出していた。
 * 置いた場所が見えているのは良いが、
 *
 *   1. 置きたい場所が中央でないなら、必ず1回は掴んで運ぶ
 *   2. 欲しい大きさが既定でないなら、必ず1回は角を掴んで直す
 *
 * つまり**毎回2手ずつ余計にかかる**。図を描く道具（Figma / Miro / draw.io）が
 * そろって「選んで、引いて作る」なのはこのため。引き終わった時点で、
 * 置き場所も大きさも決まっている。
 *
 * ## 引かずに押したときは
 *
 * それでも「とりあえず1枚置きたい」ことはある。**ちょんと押しただけなら、
 * その場所に既定の大きさで置く**。引く作り方に寄せて、押す作り方を取り上げない。
 */

/** これ未満の動きは「押しただけ」とみなす(画面px)。手の震えで大きさが決まらないように */
export const CLICK_SLOP = 8

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }

/** 押しただけか、引いたか。判定は**画面の上での距離**で行う（拡大率に左右されない） */
export function isClick(start: Point, end: Point, slop = CLICK_SLOP): boolean {
  return Math.abs(end.x - start.x) < slop && Math.abs(end.y - start.y) < slop
}

/**
 * 引いた範囲から、図形の矩形を作る。
 *
 * どちらの向きへ引いても同じように扱う（右下へも、左上へも引ける）。
 * **小さすぎる図形は作らない。** 読めない大きさのものが盤に残ると、
 * 掴むことも消すことも難しくなる。
 */
export function rectFromDrag(start: Point, end: Point, minSize: number): Rect {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const width = Math.max(Math.abs(end.x - start.x), minSize)
  const height = Math.max(Math.abs(end.y - start.y), minSize)
  return { x: Math.round(left), y: Math.round(top), width: Math.round(width), height: Math.round(height) }
}

/**
 * 押した場所へ、既定の大きさで置くときの左上。
 *
 * 押した点を左上にすると、図形が指の右下へ伸びて、押した場所と出た場所がずれて見える。
 * **押した点を中心にする。**
 */
export function centeredAt(point: Point, width: number, height: number): Point {
  return { x: Math.round(point.x - width / 2), y: Math.round(point.y - height / 2) }
}

/** 引いている最中の帯（画面座標）。見えている範囲に何が出るかを、離す前に見せる */
export function bandStyle(start: Point, end: Point): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}
