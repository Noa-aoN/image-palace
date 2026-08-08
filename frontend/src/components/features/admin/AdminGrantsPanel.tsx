'use client'

import { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import {
  getAdminGrantPolicies,
  resetAdminGrantPolicy,
  updateAdminGrantPolicy,
} from '@/lib/api/admin'
import type { AdminGrantPolicy } from '@/types/admin'

const ITEM_KIND_LABELS: Record<string, string> = {
  box: 'ボックス',
  space: 'スペース',
  view: 'キャンバス',
  wordlist: 'ワードリスト',
  skin: 'スキン',
}

/**
 * 付与ポリシーの管理。「何を・いくつ・配るかどうか」を運営が変えられる。
 *
 * 触っていないキーは Billing::Catalog の既定で動いている（customized=false）。
 * 変えたあとで「既定へ戻す」を押せば、また定数の値に従う。
 */
export function AdminGrantsPanel() {
  const [policies, setPolicies] = useState<AdminGrantPolicy[]>([])
  const [itemKinds, setItemKinds] = useState<string[]>([])
  const [readyKinds, setReadyKinds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminGrantPolicies()
      .then((data) => {
        if (cancelled) return
        setPolicies(data.policies)
        setItemKinds(data.item_kinds)
        setReadyKinds(data.ready_item_kinds)
      })
      .catch(() => {
        if (!cancelled) setError('付与の設定を取得できませんでした')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function replace(updated: AdminGrantPolicy) {
    setPolicies((prev) => prev.map((row) => (row.key === updated.key ? updated : row)))
  }

  async function save(key: string, patch: Partial<AdminGrantPolicy>) {
    setSavingKey(key)
    setError(null)
    try {
      replace(await updateAdminGrantPolicy(key, patch))
    } catch {
      setError('保存できませんでした')
    } finally {
      setSavingKey(null)
    }
  }

  async function reset(key: string) {
    setSavingKey(key)
    try {
      replace(await resetAdminGrantPolicy(key))
    } catch {
      setError('戻せませんでした')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center py-12 text-muted-foreground">
        <Loader2 size={18} className="mr-2 animate-spin" /> 読み込み中…
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">付与ポリシー</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          何を・いくつ・配るかどうかを決める。触っていない項目はコード側の既定で動いている。
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {policies.map((policy) => (
          <div key={policy.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {policy.label}
                  <span className="ml-2 text-xs text-muted-foreground">{policy.key}</span>
                  {policy.customized && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">設定済み</span>
                  )}
                </p>
                {policy.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{policy.description}</p>
                )}
              </div>

              {policy.ready ? (
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policy.enabled}
                    disabled={savingKey === policy.key}
                    onChange={(e) => save(policy.key, { enabled: e.target.checked })}
                  />
                  配る
                </label>
              ) : (
                // 受け取り側の仕組みができるまでは有効にできない（サーバー側でも弾く）
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  準備中
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {policy.reward_type === 'credits' ? '付与クレジット' : '個数'}
                </span>
                <input
                  type="number"
                  min={0}
                  defaultValue={policy.amount}
                  disabled={savingKey === policy.key}
                  onBlur={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isFinite(next) && next !== policy.amount) save(policy.key, { amount: next })
                  }}
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1 tabular-nums"
                />
              </label>

              {policy.reward_type === 'item' && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">種類</span>
                  <select
                    value={policy.item_kind ?? ''}
                    disabled={savingKey === policy.key}
                    onChange={(e) => save(policy.key, { item_kind: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1"
                  >
                    {itemKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {ITEM_KIND_LABELS[kind] ?? kind}
                        {readyKinds.includes(kind) ? '' : '（準備中）'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {policy.default_amount !== null && policy.amount !== policy.default_amount && (
                <span className="text-xs text-muted-foreground">既定 {policy.default_amount}</span>
              )}

              {policy.customized && (
                <button
                  type="button"
                  onClick={() => reset(policy.key)}
                  disabled={savingKey === policy.key}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                >
                  <RotateCcw size={12} /> 既定へ戻す
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 受け取り側の仕組みが無いものは、設定できても実際には配られない */}
      <p className="text-xs text-muted-foreground">
        「準備中」は受け取り側の仕組みがまだ無いもの。設定は保存しておけるが、有効にはできない
        （配られていないことに気づけなくなるため、サーバー側でも弾いている）。
        機能ができたら <code>GrantPolicy::READY_ITEM_KINDS</code> にその種類を足すと有効にできる。
      </p>
    </section>
  )
}
