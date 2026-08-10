'use client'

import { useEffect, useState } from 'react'
import { Ticket, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  getAdminCampaignCodes,
  createAdminCampaignCode,
  updateAdminCampaignCode,
  deleteAdminCampaignCode,
} from '@/lib/api/admin'
import type { AdminCampaignCode } from '@/types/admin'

/**
 * 引き換えコードの発行と成績。
 *
 * 発行を気軽にできることが要点なので、必須は「名前」と「配るクレジット」の2つだけ。
 * 期限・上限・有効日数は空のままでよく、空なら制限なしとして扱う。
 *
 * 一度でも受け取られたコードは消せない。誰が何を受け取ったかの記録が消えるため、
 * 配布を止めたいときは無効にする。
 */
export function AdminCampaignCodesPanel() {
  const [codes, setCodes] = useState<AdminCampaignCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('3')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [creditValidDays, setCreditValidDays] = useState('')

  useEffect(() => {
    getAdminCampaignCodes()
      .then((page) => setCodes(page.codes))
      .catch(() => setError('読み込めませんでした。'))
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!label.trim() || busy) return
    setBusy('new')
    setError(null)
    try {
      const created = await createAdminCampaignCode({
        label: label.trim(),
        amount: Number(amount) || 0,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expires_at: expiresAt || null,
        credit_valid_days: creditValidDays ? Number(creditValidDays) : null,
      })
      setCodes((rows) => [created, ...rows])
      setLabel('')
      setMaxRedemptions('')
      setExpiresAt('')
      setCreditValidDays('')
    } catch (e) {
      setError(errorMessage(e, '発行できませんでした。'))
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (row: AdminCampaignCode) => {
    setBusy(row.id)
    setError(null)
    try {
      const updated = await updateAdminCampaignCode(row.id, { enabled: !row.enabled })
      setCodes((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
    } catch (e) {
      setError(errorMessage(e, '変更できませんでした。'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (row: AdminCampaignCode) => {
    setBusy(row.id)
    setError(null)
    try {
      await deleteAdminCampaignCode(row.id)
      setCodes((rows) => rows.filter((r) => r.id !== row.id))
    } catch (e) {
      setError(errorMessage(e, '削除できませんでした。'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Ticket size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">引き換えコード</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        コードを発行すると、受け取った人の残高にクレジットが足されます。1人1回までです。
        <br />
        配りすぎを止めるのは<strong className="text-foreground">受け取れる人数</strong>だけです。
        空のままだと、コードが広まったぶんだけ配られます。
      </p>

      {/* 発行フォーム。必須は名前とクレジットだけ */}
      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="campaign-label">名前（運営用）</Label>
          <Input
            id="campaign-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="春の配布"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="campaign-amount">配るクレジット</Label>
          <Input
            id="campaign-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="campaign-max">受け取れる人数</Label>
          <Input
            id="campaign-max"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            inputMode="numeric"
            placeholder="無制限"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="campaign-expires">受け取り期限</Label>
          <Input
            id="campaign-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="campaign-valid">配るクレジットの有効日数</Label>
          <Input
            id="campaign-valid"
            value={creditValidDays}
            onChange={(e) => setCreditValidDays(e.target.value)}
            inputMode="numeric"
            placeholder="通常どおり"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={create} disabled={!label.trim() || busy === 'new'} className="flex items-center gap-1.5">
            {busy === 'new' ? <Spinner size={14} /> : <Plus size={14} />}
            発行
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 読み込み中…
        </p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだコードはありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">コード</th>
                <th className="py-2 pr-3">名前</th>
                <th className="py-2 pr-3 text-right">1人あたり</th>
                <th className="py-2 pr-3 text-right">受け取り</th>
                <th className="py-2 pr-3 text-right">受け取り率</th>
                <th className="py-2 pr-3 text-right">配った合計</th>
                <th className="py-2 pr-3">状態</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {codes.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.amount} cr</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.redeemed_count}
                    {row.max_redemptions != null && ` / ${row.max_redemptions}`}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {/* 上限を決めていないコードに率は無い。分母が存在しない */}
                    {row.redemption_rate == null ? '—' : `${Math.round(row.redemption_rate * 100)}%`}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.granted_credits} cr</td>
                  <td className="py-2 pr-3">
                    <StatusLabel row={row} />
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle(row)}
                        disabled={busy === row.id}
                        className="text-xs"
                      >
                        {row.enabled ? '止める' : '再開'}
                      </Button>
                      {row.redeemed_count === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(row)}
                          disabled={busy === row.id}
                          aria-label="削除"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}

// 止まっている理由まで出す。「使えない」だけだと、期限なのか人数なのか分からない
function StatusLabel({ row }: { row: AdminCampaignCode }) {
  if (!row.enabled) return <span className="text-muted-foreground">止めている</span>
  if (row.available) return <span style={{ color: 'var(--palace)' }}>受付中</span>
  if (row.max_redemptions != null && row.redeemed_count >= row.max_redemptions) {
    return <span className="text-muted-foreground">人数に達した</span>
  }
  return <span className="text-muted-foreground">期間外</span>
}

function errorMessage(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { error?: string; errors?: string[] } } })?.response?.data
  return detail?.error || detail?.errors?.join('・') || fallback
}
