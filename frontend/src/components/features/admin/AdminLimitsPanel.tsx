'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { checkAdminProvider } from '@/lib/api/admin'
import type { AdminOverview, AdminProviderCheck } from '@/types/admin'

/**
 * 「いま何枚まで作れる設定なのか」と「供給側が止まっていないか」をまとめて見る。
 *
 * 上限の値は定数と環境変数に散っているため、出どころ（ENV 名）も一緒に出す。
 * 画面の数字と実態がずれていると、運用の判断がそのままずれる。
 */
export function AdminLimitsPanel({ overview }: { overview: AdminOverview }) {
  const { limits, provider_status: status, queue } = overview
  const [check, setCheck] = useState<AdminProviderCheck | null>(null)
  const [checking, setChecking] = useState(false)

  async function runCheck() {
    setChecking(true)
    try {
      setCheck(await checkAdminProvider())
    } catch {
      setCheck({ ok: false, code: null, message: '確認できませんでした', checked_at: new Date().toISOString() })
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">生成の上限と供給状態</h2>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {status.ongoing ? (
              <AlertTriangle size={18} className="text-destructive" aria-hidden />
            ) : (
              <CheckCircle2 size={18} className="text-muted-foreground" aria-hidden />
            )}
            <div>
              <p className="text-sm font-medium">
                {status.ongoing ? '供給側が停止しています' : '供給側の停止は検知していません'}
              </p>
              {status.last_incident && (
                <p className="text-xs text-muted-foreground">
                  最後の検知 {new Date(status.last_incident.last_occurred_at).toLocaleString('ja-JP')}（
                  {status.last_incident.provider} / {status.last_incident.code ?? status.last_incident.kind} /{' '}
                  {status.last_incident.occurrences}回）
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={runCheck}
            disabled={checking}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {checking ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> 確認中…
              </span>
            ) : (
              '疎通を確認'
            )}
          </button>
        </div>

        {check && (
          <p className={`mt-3 text-sm ${check.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
            {check.ok
              ? `応答あり（${new Date(check.checked_at).toLocaleTimeString('ja-JP')}）`
              : `応答なし: ${check.code ?? '不明'}${check.message ? ` — ${check.message}` : ''}`}
          </p>
        )}

        {/* 残高そのものは API から読めないため、実際に1回投げて判定している */}
        <p className="mt-2 text-xs text-muted-foreground">
          残高の数値は OpenAI の API からは取得できないため、実際に1回呼び出して応じるかで判定する。
          残高の確認・補充は OpenAI の請求画面から行う。
        </p>
      </div>

      {/* ワーカーが止まると、カードが「生成待ち」のまま進まない。気づけるように出す */}
      <div
        className={`rounded-xl border p-4 ${
          queue.stalled ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
        }`}
      >
        <p className="text-sm font-medium">
          {queue.stalled ? 'ジョブが滞留しています' : 'ジョブの処理'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          待機 {queue.ready} / 処理中 {queue.claimed} / ワーカー {queue.workers}
          {queue.last_heartbeat_at
            ? `・最後の心拍 ${new Date(queue.last_heartbeat_at).toLocaleString('ja-JP')}`
            : '・心拍なし'}
        </p>
        {queue.stalled && (
          <p className="mt-2 text-xs">
            積まれているのに動かすワーカーがいません。worker マシンが停止している可能性があります
            （<code>fly machine start &lt;id&gt; -a image-palace-api</code>）。
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">画像生成の上限</p>
          <p className="mt-1 text-xs text-muted-foreground">
            固定の月間上限は無く、クレジット残高が実質の上限（1クレジット = 1枚）。
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="登録時のお試し" value={`${limits.image.trial_credits} cr`} />
            <Row label="毎月の無料枠" value={`${limits.image.monthly_free_credits} cr`} />
            <Row label="クレジットの寿命" value={`${limits.image.credit_lifetime_months} か月`} />
          </dl>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 text-left font-normal">プラン</th>
                <th className="py-1 text-right font-normal">月額</th>
                <th className="py-1 text-right font-normal">月の付与</th>
              </tr>
            </thead>
            <tbody>
              {limits.image.plans.map((plan) => (
                <tr key={plan.name} className="border-t border-border/60">
                  <td className="py-1">{plan.name}</td>
                  <td className="py-1 text-right tabular-nums">¥{plan.price.toLocaleString()}</td>
                  <td className="py-1 text-right tabular-nums">{plan.monthly_credits} cr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">文章生成（AI）の上限</p>
          <p className="mt-1 text-xs text-muted-foreground">
            事故で青天井にならないための安全弁。普通に使う限り当たらない値にしてある。
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row
              label="1日あたりの回数上限"
              value={limits.ai.daily_call_cap > 0 ? `${limits.ai.daily_call_cap} 回` : '無効'}
              sub={limits.ai.daily_call_cap_env}
            />
          </dl>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 text-left font-normal">種類</th>
                <th className="py-1 text-right font-normal">1回あたり</th>
              </tr>
            </thead>
            <tbody>
              {limits.ai.cost_points.map((row) => (
                <tr key={row.kind} className="border-t border-border/60">
                  <td className="py-1">
                    {row.label}
                    {row.overridden && (
                      <span className="ml-1.5 text-xs text-muted-foreground">（{row.env} で上書き）</span>
                    )}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {row.points > 0 ? `${row.points} pt` : '無料'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">
        {label}
        {sub && <span className="ml-1.5 text-xs">{sub}</span>}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
