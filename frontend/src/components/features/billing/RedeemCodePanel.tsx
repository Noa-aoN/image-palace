'use client'

import { useState } from 'react'
import { Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { redeemCampaignCode } from '@/lib/api/billing'
import { CREDIT_UNIT } from '@/lib/billing'

/**
 * 引き換えコードの入力。
 *
 * 入力欄は常に出しておく。「コードをお持ちの方はこちら」で畳むと、
 * 配ったコードの受け取り先を案内するのが一手間増える。
 *
 * 断られた理由はそのまま出す。受け取り済みなのか、期限切れなのか、
 * 打ち間違いなのかが分からないと、同じことを何度も試すことになる。
 */
export function RedeemCodePanel({
  onRedeemed,
  title = 'コードを使う',
  note = '受け取ったコードを入力すると、クレジットが残高に足されます。',
}: {
  onRedeemed?: () => void
  /** 置く場所によって呼び名を変える（アクロポリスでは「引き換え所」） */
  title?: string
  note?: string
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = code.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await redeemCampaignCode(trimmed)
      setDone(`${result.label}：${result.credits} ${CREDIT_UNIT} を受け取りました。`)
      setCode('')
      onRedeemed?.()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Ticket size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{note}</p>

      <div className="flex flex-wrap gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="コードを入力"
          aria-label="引き換えコード"
          // 大小は区別しないが、見た目を揃えておくと打ち間違いに気づきやすい
          className="w-48 uppercase"
          disabled={busy}
        />
        <Button onClick={submit} disabled={busy || !code.trim()} className="flex items-center gap-1.5">
          {busy && <Spinner size={14} />}
          使う
        </Button>
      </div>

      {done && <p className="text-sm font-medium" style={{ color: 'var(--palace)' }}>{done}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}

// サーバーが返した文面をそのまま出す。こちらで言い換えると、
// 受け取り済みと期限切れの区別が消える
function errorMessage(e: unknown): string {
  const detail = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
  return detail || 'いま受け取れませんでした。時間を置いてお試しください。'
}
