/**
 * これから何クレジット使うのか、使ったあといくつ残るのか。
 *
 * **「押してから消費量が分かる」を無くす**ための計算。
 * 足りないときだけ出す作りだと、足りている人は最後まで単価を知らないまま使う。
 *
 * 警告にはしない。1枚1クレジットは決まりごとであって、異常ではない。
 * 強めるのは「足りない」ときと「まとめて沢山使う」ときだけ。
 */

/** これ以上をいちどに使うなら、念のため強めに出す */
export const BULK_COST_THRESHOLD = 10

export type CreditCostTone = 'plain' | 'caution' | 'blocked'

export interface CreditCost {
  /** これから使う数 */
  cost: number
  /** 残高。分からないときは null */
  available: number | null
  /** 使ったあとの残り。残高が分からなければ null。**マイナスにはしない** */
  after: number | null
  /** 足りているか。残高が分からないときは、止めない（true） */
  sufficient: boolean
  tone: CreditCostTone
}

/**
 * 残高が分からないときに止めないのは、**読めなかっただけで作れなくなるのを避ける**ため。
 * 本当に足りなければサーバーが断る。画面の役目は、知らせることであって門番ではない。
 */
export function creditCost({ cost, available }: { cost: number; available: number | null }): CreditCost {
  const safeCost = Math.max(0, Math.round(cost))
  const sufficient = available === null || available >= safeCost
  const after = available === null ? null : Math.max(0, available - safeCost)

  return {
    cost: safeCost,
    available,
    after,
    sufficient,
    tone: !sufficient ? 'blocked' : safeCost >= BULK_COST_THRESHOLD ? 'caution' : 'plain',
  }
}

/** 「1 cr 使います」。数が 0 のときは何も言わない（無料の操作） */
export function costLabel(c: CreditCost, unit: string): string | null {
  if (c.cost === 0) return null

  return `この操作で ${c.cost} ${unit} 使います`
}

/** 「残高 4 cr → 3 cr」。残高が分からないときは出さない */
export function balanceLabel(c: CreditCost, unit: string): string | null {
  if (c.available === null || c.cost === 0) return null

  return `残高 ${c.available} ${unit} → ${c.after} ${unit}`
}
