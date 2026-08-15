import type { BillingSummary } from '@/types/billing'

/**
 * 決済が反映されたか。
 *
 * **プランの変化だけを見てはいけない。** 買い切りではプランが変わらないので、
 * 正しく反映されていても「まだ」と読まれ、
 * 「決済は完了しています。プランの反映に時間がかかっているようです。」が
 * 出たまま残る。
 *
 * 見るのは2つ。どちらかが動いていれば反映されている。
 *   プランが変わった … 月額の契約・変更
 *   残高が増えた     … 買い切り、月額の初回付与
 */
export function reflected(
  before: { plan: string | null; credits: number },
  now: Pick<BillingSummary, 'plan' | 'available_credits'>
): boolean {
  if ((now.plan?.name ?? null) !== before.plan) return true

  return now.available_credits > before.credits
}
