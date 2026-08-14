// 課金表示まわりの共有ヘルパー（プラン名の日本語化・金額/クレジット表示）。

// クレジットの単位表記。full = 残高表示など、short = ヘッダー等の省略記号。
export const CREDIT_UNIT = 'クレジット'
export const CREDIT_UNIT_SHORT = 'cr'

/**
 * プランの呼び名。
 *
 * 内部の識別名（free / standard / …）と Stripe の商品名はそのまま。ここは**表示だけ**で、
 * 契約や決済には触れない。名前を変えても既存の契約は動かない。
 *
 * 宮殿の世界観に寄せつつ、上下関係が読み取れる言葉にしてある。
 * 市民 → 書記官 → 学匠 → 賢者 → 元老、と役割が重くなる並び。
 *
 * **無料でも「客人」にはしない。** 無料の人も自分の宮殿の主人であって、
 * 招かれた側ではない。いちばん下を市民から始める。
 */
const TIER_LABELS: Record<string, string> = {
  free: '市民',
  standard: '書記官',
  pro: '学匠',
  creator: '賢者',
  studio: '元老',
  topup: 'クレジット追加',
}

/** 呼び名だけでは分かりにくいので、一覧では添え書きを出す */
export const TIER_NOTES: Record<string, string> = {
  free: 'まずは試す',
  standard: '日々の学習に',
  pro: '本格的に作る',
  creator: '作品として仕上げる',
  studio: '規模をもって取り組む',
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

/**
 * クレジットの有効期間（サーバーの Billing::CreditExpiryPolicy と揃える）。
 * 期限を出さないと、ある日いきなり減ったように見える。
 *
 * 出どころで期間は変えない。月額のぶんも買い切りと同じだけ持つ。
 * 画面に出す「◯か月」はここだけに書く。散らすと規約と食い違う。
 */
export const CREDIT_VALIDITY_MONTHS = 3

export const CREDIT_VALIDITY_LABEL = `${CREDIT_VALIDITY_MONTHS}か月`

export const TOPUP_VALIDITY = `購入から${CREDIT_VALIDITY_LABEL}ぶん有効・繰り越します`

export const SUBSCRIPTION_VALIDITY = `受け取りから${CREDIT_VALIDITY_LABEL}ぶん有効・使い残しは繰り越します`

/**
 * その量を期限までに使い切るなら、月に何枚作ることになるか。
 *
 * **大きい束ほど、期限のほうが先に来る。** 1000枚を3か月なら月333枚で、
 * ふつうの使い方では余らせる。値段の安さだけ見て買うと、あとで損に気づく。
 * 買う前に「自分はそこまで作るか」を確かめられるように、量ではなく速さで見せる。
 */
export function monthlyPace(credits: number, months = CREDIT_VALIDITY_MONTHS): number {
  if (credits <= 0 || months <= 0) return 0

  return Math.ceil(credits / months)
}
