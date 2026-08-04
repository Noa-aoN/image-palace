'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCreditTransactions } from '@/lib/api/billing'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import type { CreditTransaction } from '@/types/billing'

/**
 * クレジットの増減の明細。
 *
 * 「いつ・何で・いくら増えた／減った」が追えないと、残高が合わないときに
 * 利用者も運営も確かめようがない。台帳はもともと追記のみで持っているので、それを見せる。
 *
 * 件数は増え続けるので、続きは押したときだけ読む。
 */
export function CreditHistoryPanel() {
  const [rows, setRows] = useState<CreditTransaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async (from?: string | null) => {
    setLoading(true)
    try {
      const page = await getCreditTransactions(from)
      setRows((prev) => (from ? [...prev, ...page.transactions] : page.transactions))
      setCursor(page.next_cursor)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // 初回のみ
     
  }, [])

  if (error) return null

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <History size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">クレジット履歴</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        クレジットが増えた・減った記録です。生成1枚につき 1 {CREDIT_UNIT_SHORT} 消費します。
      </p>

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">まだ記録はありません。</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString('ja-JP')}
                  {row.description && <> / {row.description}</>}
                </p>
              </div>
              <span
                className={`shrink-0 tabular-nums font-medium ${
                  row.credits >= 0 ? 'text-green-700' : 'text-muted-foreground'
                }`}
              >
                {row.credits > 0 && '+'}
                {formatCredits(row.credits)} {CREDIT_UNIT_SHORT}
              </span>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <Button variant="outline" size="sm" onClick={() => load(cursor)} disabled={loading}>
          {loading ? '読み込み中…' : 'さらに読み込む'}
        </Button>
      )}
    </section>
  )
}

// 整数はそのまま、端数があるものだけ小数で見せる（0.01cr の消費があるため）
function formatCredits(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}
