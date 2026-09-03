'use client'

import { useEffect, useState } from 'react'
import { Coins, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { drawAdminOpsCredits, getAdminOpsCredits, type AdminOpsCreditAccount } from '@/lib/api/admin'
import { useCanOperate } from '@/hooks/useAdminPermissions'
import { ReadOnlyNotice } from '@/components/features/admin/ReadOnlyNotice'

/**
 * 運営クレジット。
 *
 * **財布はひとつ。** 運営の生成も、ほかの利用者とまったく同じ道で残高から引かれる。
 * 以前は別の財布から引いていたため、残高が1点も動かず
 *   ・数え方の不具合に気づけない（実際、気づけなかった）
 *   ・どれだけ使っているかも分からない
 * という状態だった。
 *
 * 運営の予算は、ここから**残高へ入れる**。入れる量には月ごとの上限がある。
 * 間違いや暴走がそのまま費用になるのを、近づいたときに気づけるようにするため。
 */
export function AdminOpsCreditsPanel() {
  const canWrite = useCanOperate()
  const [accounts, setAccounts] = useState<AdminOpsCreditAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [credits, setCredits] = useState('50')
  const [reason, setReason] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminOpsCredits()
      .then((rows) => {
        if (!cancelled) setAccounts(rows)
      })
      .catch(() => {
        if (!cancelled) setError('運営クレジットの状況を取得できませんでした')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const draw = async () => {
    const amount = Number(credits)
    if (!Number.isFinite(amount) || amount < 1 || !reason.trim()) return

    setDrawing(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await drawAdminOpsCredits(amount, reason.trim())
      setAccounts((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
      setReason('')
      setNotice(`${amount} cr を残高へ入れました。`)
    } catch (e) {
      const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(message ?? '入れられませんでした')
    } finally {
      setDrawing(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Coins size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">運営クレジット</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        運営の予算を、自分の残高へ入れます。入れたあとは普通のクレジットとして減るので、
        使った量も、数え方の不具合も、利用者と同じ画面で分かります。
      </p>

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> 読み込んでいます…
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">運営</th>
                <th className="px-3 py-2 text-right font-medium">今月入れた</th>
                <th className="px-3 py-2 text-right font-medium">今月使った</th>
                <th className="px-3 py-2 text-right font-medium">つくった絵</th>
                <th className="px-3 py-2 text-right font-medium">いまの残高</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.allowance ? (
                      <>
                        {row.allowance.used_credits}
                        <span className="text-muted-foreground"> / {row.allowance.limit_credits}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.spent_credits}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.generated_images} 枚</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{row.available_credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 上限は「使い切らない大きさ」を置いてあるだけで、止めるためのものではない。
          足りなければ『料金と枠』の studio_allowance を上げられる、と添える */}
      <p className="text-xs text-muted-foreground">
        今月入れられる上限は、下の「配るものの設定」の <code>studio_allowance</code> で変えられます。
      </p>

      {canWrite ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="ops-credits">入れる量（cr）</Label>
              <Input
                id="ops-credits"
                type="number"
                min={1}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="w-28"
                disabled={drawing}
              />
            </div>
            <div className="min-w-[16rem] flex-1 space-y-1">
              <Label htmlFor="ops-reason">理由</Label>
              <Input
                id="ops-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="公式カードの作成 など"
                disabled={drawing}
              />
            </div>
            <Button onClick={draw} disabled={drawing || !reason.trim()} className="flex items-center gap-1.5">
              {drawing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              残高へ入れる
            </Button>
          </div>
          {/* 理由を必須にするのは、あとから見て「なぜ入れたか」が分からない記録を残さないため */}
          <p className="text-xs text-muted-foreground">
            理由は監査ログに残ります。あとから「なぜ入れたか」を辿れるように書いてください。
          </p>
        </div>
      ) : (
        <ReadOnlyNotice what="運営クレジットを入れる" />
      )}

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
