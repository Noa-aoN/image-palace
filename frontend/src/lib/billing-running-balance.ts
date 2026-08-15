import type { CreditTransaction } from '@/types/billing'

/**
 * 履歴の各行に「その時点の残高」を添える。
 *
 * **行が持っている `*_credits_after` は使えない。** あれは古い入れ物
 * （月々のぶん・期限なしの買い切り）の残高で、いまの残高の主役である
 * 期限付きのぶんを含まない。実際、買い切りの行で 187 と記録されている一方、
 * そのときの実残高は 508 だった。足すと**嘘の数字**になる。
 *
 * 代わりに、いまの残高から遡って積む。台帳は増減を漏れなく持っている
 * （失効も1行として残る）ので、新しい行から順に引いていけば当時の残高になる。
 *
 * rows は**新しい順**であること。
 */
export function withRunningBalance<T extends Pick<CreditTransaction, 'credits'>>(
  rows: T[],
  currentBalance: number
): (T & { balanceAfter: number })[] {
  let balance = currentBalance

  return rows.map((row) => {
    const withBalance = { ...row, balanceAfter: balance }
    // ひとつ古い行の時点では、この行の増減はまだ起きていない
    balance -= row.credits
    return withBalance
  })
}
