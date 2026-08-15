/**
 * 数を出すか。
 *
 * **宝物は重ねて持てる。** 1個でも数を出しておくと、増えるものだと分かる。
 * 称号・勲章・表彰は1人1つきりなので、`×1` と書くと数える対象に見えてしまう
 * （2つ以上あるときだけ出す。実際には起こらないが、書き換わっても壊れない側に倒す）。
 */
export function showQuantity(reward: { kind: string; quantity: number; owned: boolean }): boolean {
  if (reward.quantity < 1) return false
  if (reward.kind === 'treasure') return reward.owned

  return reward.quantity > 1
}
