// 課金表示まわりの共有ヘルパー（プラン名の日本語化・金額/クレジット表示）。

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
