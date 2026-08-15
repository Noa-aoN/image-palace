import type { RewardKind } from '@/lib/api/achievements'

/**
 * 獲得物を並べる順。**名乗る側から、持ち物側へ。**
 *
 *   称号 … 名乗り（1つだけ掲げる）
 *   勲章 … 名乗りに添える証
 *   表彰 … 運営から贈られたもの
 *   宝物 … 部屋に置く品物（重ねて持てる）
 *
 * 種別そのものの一覧（`RewardDefinition::KINDS`）とは別に持つ。
 * あちらは「どれが有効な種別か」で、順番の意味は無い。
 */
export const KIND_DISPLAY_ORDER: RewardKind[] = ['title', 'medal', 'honor', 'treasure']

/** 記名板に絵を並べる順。称号は名前として別に出すので含めない */
export const KIND_SHOWCASE_ORDER: RewardKind[] = ['medal', 'honor', 'treasure']

/** 並べ替えに使う重み。知らない種別は末尾へ */
export function kindRank(kind: string): number {
  const index = KIND_DISPLAY_ORDER.indexOf(kind as RewardKind)
  return index === -1 ? KIND_DISPLAY_ORDER.length : index
}
