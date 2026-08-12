/**
 * 経営の数字の見せ方。
 *
 * 計算そのものはサーバー（Admin::BusinessMetricsService）が持つ。
 * ここにあるのは「画面に出すときの決めごと」だけ。
 */

export interface MetricDelta {
  /** 前の期間からの変化率（%）。小数第1位まで */
  rate: number
  /** 増えたか（横ばい 0% も増加側として扱う） */
  up: boolean
}

/**
 * 前の期間と比べた変化率。
 *
 * **前が 0 のときは出さない。** 0 から 1 への変化は率にすると無限大で、
 * 「+100%」と書くと 1 から 2 への変化と同じ見た目になってしまう。
 * 母数が無いことは、増減が無いこととは違う。
 */
export function deltaRate(current: number, previous: number): MetricDelta | null {
  if (previous === 0) return null

  const rate = ((current - previous) / previous) * 100
  return { rate: Math.round(rate * 10) / 10, up: rate >= 0 }
}

/**
 * 出せない数字の見せ方。
 *
 * null は「測れない」であって「0」ではない。空欄にもしない。
 * 空欄だと、読み込みに失敗したのか、そもそも無いのかが読めない。
 */
export function isUnmeasured(value: number | null | undefined): boolean {
  return value === null || value === undefined
}
