/**
 * 札を列へ振り分ける。
 *
 * 自動のときは画面（CSS の段組み）が折り返しを決めるので、ここは通らない。
 * ここは**自分で個数を決めたとき**だけの計算。
 *
 * 決まりは2つ。
 *   1. 並びは変えない。上から順に、決めた数だけ左の列から詰める
 *   2. **余ったぶんは最後の列へ回す**。数を書き換えたときに札が消えないため
 */
export function splitIntoColumns<T>(items: T[], counts: number[], columns: number): T[][] {
  const width = Math.max(1, Math.floor(columns))
  const result: T[][] = Array.from({ length: width }, () => [])
  let cursor = 0

  for (let index = 0; index < width; index += 1) {
    const take = Math.max(0, Math.floor(counts[index] ?? 0))
    result[index] = items.slice(cursor, cursor + take)
    cursor += result[index].length
  }

  // 決めた数の合計が足りなくても、札は必ずどこかに出す
  if (cursor < items.length) result[width - 1].push(...items.slice(cursor))

  return result
}

/**
 * 自分で決める側へ切り替えたときの、はじめの数。
 * **いまの見え方に近いところから始める**ので、なるべく均す（端数は左の列から）。
 */
export function evenColumnCounts(total: number, columns: number): number[] {
  const width = Math.max(1, Math.floor(columns))
  const base = Math.floor(total / width)
  const extra = total % width

  return Array.from({ length: width }, (_, index) => base + (index < extra ? 1 : 0))
}
