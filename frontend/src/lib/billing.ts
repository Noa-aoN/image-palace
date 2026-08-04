// 課金表示まわりの共有ヘルパー（プラン名の日本語化・金額/クレジット表示）。

// クレジットの単位表記。full = 残高表示など、short = ヘッダー等の省略記号。
export const CREDIT_UNIT = 'クレジット'
export const CREDIT_UNIT_SHORT = 'cr'

const TIER_LABELS: Record<string, string> = {
  free: 'フリー',
  standard: 'スタンダード',
  pro: 'プロ',
  creator: 'クリエイター',
  studio: 'スタジオ',
  topup: 'クレジット追加',
}

export function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier
}

export function formatYen(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`
}

// 残クレジットからおおよその作成可能枚数を出す（現状 1生成 = 1クレジット）。
export function estimatedCards(availableCredits: number): number {
  return Math.floor(availableCredits)
}

/**
 * 買い切りプランの1クレジットあたりの価格。
 * まとめるほど安くなることを画面で示すために使う。
 */
export function unitPrice(plan: { price: number; credits: number }): number {
  if (plan.credits <= 0) return 0

  return plan.price / plan.credits
}

/**
 * 基準（いちばん割高なもの）と比べて何%安いか。切り捨ての整数で返す。
 * 基準そのものや、基準より高いものは 0 を返す（「0% お得」を出さないため）。
 *
 * 切り捨てにするのは、実際より多く見せないため。
 * ただし 12/15 が 0.7999… になるような誤差でちょうどの値が1つ下がってしまうので、
 * 小数第1位に丸めてから切り捨てる。
 */
export function discountPercent(rate: number, baseRate: number): number {
  if (baseRate <= 0 || rate >= baseRate) return 0

  const percent = Math.round((1 - rate / baseRate) * 1000) / 10
  return Math.floor(percent)
}
