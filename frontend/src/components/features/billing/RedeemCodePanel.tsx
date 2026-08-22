'use client'

import { Plus } from 'lucide-react'

import { useCallback, useEffect, useState } from 'react'
import { Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { getCodeRedemptions, redeemCampaignCode, type CodeRedemption } from '@/lib/api/billing'
import { CREDIT_UNIT } from '@/lib/billing'
import { isSubmitEnter } from '@/lib/enter-key'

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
  note = '受け取ったコードを入力すると、クレジットか公式コンテンツが届きます。',
  withHistory = false,
}: {
  onRedeemed?: () => void
  /** 置く場所によって呼び名を変える（デルフォイでは「引き換え所」） */
  title?: string
  note?: string
  /** これまでに引き換えたものを下に並べるか */
  withHistory?: boolean
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [history, setHistory] = useState<CodeRedemption[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 履歴は開いた面でだけ引く。引き換えたら取り直す（受け取った結果がその場で並ぶ）
  const loadHistory = useCallback(
    async (limit?: number) => {
      if (!withHistory) return
      try {
        const page = await getCodeRedemptions(limit)
        setHistory(page.redemptions)
        setHasMore(page.has_more)
      } catch {
        setHistory([])
      }
    },
    [withHistory]
  )

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const submit = async () => {
    const trimmed = code.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await redeemCampaignCode(trimmed)
      // 公式コンテンツのコードは、クレジットが増えない。
      // 「0 cr を受け取りました」と出ると、失敗したように読める
      setDone(
        result.package
          ? `${result.package}：${result.items ?? 0}枚を宮殿に迎えました。`
          : `${result.label}：${result.credits} ${CREDIT_UNIT} を受け取りました。`
      )
      setCode('')
      onRedeemed?.()
      loadHistory(expanded ? 100 : undefined)
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
            if (isSubmitEnter(e)) {
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

      {/* 引き換えた記録。1件1行で並べる。
          期限や残りまで札にすると縦に伸びて、履歴を見るために画面を送ることになる */}
      {withHistory && history && history.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">引き換えた記録</p>
          <ul className="divide-y divide-border">
            {history.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="truncate font-mono text-xs">{row.code ?? '—'}</span>
                <span className="flex shrink-0 items-baseline gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {row.credits} {CREDIT_UNIT}
                    {row.remaining_credits < row.credits && `（残 ${row.remaining_credits}）`}
                  </span>
                  <time dateTime={row.redeemed_at} className="tabular-nums">
                    {new Date(row.redeemed_at).toLocaleDateString('ja-JP')}
                  </time>
                </span>
              </li>
            ))}
          </ul>
          {/* 常に出すのは3件まで。ここは主役ではない（主役は入力欄）ので、
              続きは押したときだけ足す */}
          {hasMore && !expanded && (
            <button
              type="button"
              onClick={() => {
                setExpanded(true)
                loadHistory(100)
              }}
              aria-label="引き換えた記録をもっと読み込む"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// サーバーが返した文面をそのまま出す。こちらで言い換えると、
// 受け取り済みと期限切れの区別が消える
function errorMessage(e: unknown): string {
  const detail = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
  return detail || 'いま受け取れませんでした。時間を置いてお試しください。'
}
