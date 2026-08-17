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
  const safeCost = round2(Math.max(0, cost))
  const sufficient = available === null || available >= safeCost
  const after = available === null ? null : round2(Math.max(0, available - safeCost))

  return {
    cost: safeCost,
    available,
    after,
    sufficient,
    tone: !sufficient ? 'blocked' : safeCost >= BULK_COST_THRESHOLD ? 'caution' : 'plain',
  }
}

/**
 * 小数第2位まで。**文章のAIは 0.01 cr 単位**なので、整数に丸めると全部 0 になり、
 * 「使ったのに何も減っていない」ように見える。
 *
 * 0.1 + 0.2 が 0.30000000000000004 になる類の誤差も、ここで落としておく
 * （合計を出すときに桁が溢れると、金額の話として読めなくなる）。
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * 数の書き方。**末尾の 0 は出さない**（`1.00 cr` は読みにくく、
 * 1 と 1.00 が別のものに見える）。
 */
export function formatCredits(value: number): string {
  return String(round2(value))
}

/** 「1 cr 使います」。数が 0 のときは何も言わない（無料の操作） */
export function costLabel(c: CreditCost, unit: string): string | null {
  if (c.cost === 0) return null

  // **短く言い切る。** 「この操作で」は、押す釦の隣に置いている以上、
  // 読まなくても何の費用かは分かる。長い文は狭い場所で折り返し、
  // 「1 cr 使い / ます」のように数と単位が分かれて読みにくくなる
  return `${formatCredits(c.cost)} ${unit} 使います`
}

/**
 * 「生成後残高：3 cr」。**使ったあとの残りだけ**を言う。
 *
 * 押す前から数が動く場所（書きながら枚数が変わるクイック作成）では、
 * 「いくら使うか」と「いま幾らか」と「いくつ残るか」の3つが同時に動く。
 * 3つとも出すと目が追えないので、いちばん知りたい**残り**だけに絞る。
 */
export function afterBalanceLabel(c: CreditCost, unit: string): string | null {
  if (c.available === null || c.cost === 0) return null

  return `生成後残高：${formatCredits(c.after ?? 0)} ${unit}`
}

/**
 * 「残高 4 → 3 cr」。残高が分からないときは出さない。
 *
 * 単位は末尾に1つだけ置く。両方に付けると、狭い場所では
 * 「残高 4 cr → / 3 cr」と矢印の前後で折り返してしまう
 */
export function balanceLabel(c: CreditCost, unit: string): string | null {
  if (c.available === null || c.cost === 0) return null

  return `残高 ${formatCredits(c.available)} → ${formatCredits(c.after ?? 0)} ${unit}`
}
