/**
 * 残高から「あと何枚作れるか」を数える。
 *
 * 1枚 = 1クレジットなので、端数では作れない。切り捨てる。
 * 残高そのものは小数になりうる（AI調整のように 0.01cr 単位で減るものがあるため）が、
 * 枚数として見せるときは必ず整数にする。
 */
export function generatableCards(availableCredits: number): number {
  if (!Number.isFinite(availableCredits) || availableCredits <= 0) return 0

  return Math.floor(availableCredits)
}
