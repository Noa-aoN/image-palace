// 公式コンテンツを「開かずに分かる」形にする。
//
// 受け取る前に中身を全部見せる必要はない。
// **何がいくつ届くか**だけ分かれば、押すかどうかは決められる。

export type Counts = {
  items: number
  boxes: number
  views: number
  tags: number
}

/**
 * 中身の内訳。**0のものは並べない。**
 * 「キャンバス 0」と書いてあっても、読む人には何の足しにもならない。
 */
export function describeCounts(counts: Counts | null | undefined): string[] {
  if (!counts) return []

  return [
    { label: 'カード', value: counts.items },
    { label: 'ボックス', value: counts.boxes },
    { label: 'キャンバス', value: counts.views },
    { label: 'タグ', value: counts.tags },
  ]
    .filter((row) => row.value > 0)
    .map((row) => `${row.label} ${row.value}`)
}

/** 見出しの脇に出す一言。枚数が主役 */
export function headlineCount(counts: Counts | null | undefined): string {
  const items = counts?.items ?? 0
  return items > 0 ? `${items}枚` : '準備中'
}

/**
 * その荷物を押せるか、押せないなら理由は何か。
 *
 * **受け取り済みと、枠を使い切ったのは別のこと。**
 * 前者はその荷物の話で、後者はその人の話。同じ「押せません」でも、
 * 何をすればよいかが違う。
 */
export type Availability =
  | { canInstall: true }
  | { canInstall: false; reason: 'received' | 'no_free_left'; message: string }

export function availability(
  pkg: { received: boolean },
  freeRemaining: number
): Availability {
  if (pkg.received) {
    return { canInstall: false, reason: 'received', message: '受け取り済み' }
  }
  if (freeRemaining <= 0) {
    return {
      canInstall: false,
      reason: 'no_free_left',
      message: '無料で受け取れるのは1つまでです',
    }
  }
  return { canInstall: true }
}
