'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminUsers, updateAdminUserRole } from '@/lib/api/admin'
import { PeriodSelect } from './PeriodSelect'
import type { AdminRole, AdminUser, AdminUserStats, AdminUsersPage } from '@/types/admin'
import { ROLE_LABELS } from '@/lib/admin-roles'
import { StrongAuthPrompt } from '@/components/features/account/StrongAuthPrompt'

// 弱い順に並べる。付け外しの選択肢として、上げ下げの向きが見て分かるように
const ROLES: AdminRole[] = ['user', 'support', 'operator', 'admin']

/**
 * 利用者の一覧と、役割の付け外し。
 *
 * 役割を変えるのは運営の管理者だけ。将来チームが増えたり、運営を引き継いだりするとき、
 * 環境変数を触らずに人を足したり移したりできるようにするための入口。
 *
 * 権限を上げる操作は取り消しが効かないので、確認を挟んでから実行する。
 */
export function AdminUsersPanel({ canChangeRole }: { canChangeRole: boolean }) {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState<AdminUsersPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ id: string; role: AdminRole } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 既定は全期間。ここは探しに来る面なので、既定で古い人が落ちると使えない
  const [period, setPeriod] = useState('all')

  const load = useCallback(
    async (q: string, pageNumber = 1, range = period) => {
      setLoading(true)
      try {
        setPage(await getAdminUsers({ q: q || undefined, page: pageNumber, period: range }))
      } catch {
        setError('一覧を取得できませんでした')
      } finally {
        setLoading(false)
      }
    },
    [period]
  )

  useEffect(() => {
    load(submittedQuery)
  }, [load, submittedQuery])

  // 確かめが切れていたときに、確かめ終わってから続きをやるための控え
  const [pendingRole, setPendingRole] = useState<{ user: AdminUser; role: AdminRole } | null>(null)

  const changeRole = async (user: AdminUser, role: AdminRole) => {
    setBusyId(user.id)
    setError(null)
    try {
      const updated = await updateAdminUserRole(user.id, role)
      setPage((prev) =>
        prev ? { ...prev, users: prev.users.map((u) => (u.id === updated.id ? updated : u)) } : prev
      )
      setConfirming(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string }; status?: number } }
      // 確かめが切れていたら、その場で確かめてもらう。
      // 権限を触るのは、乗っ取られたときの被害がいちばん大きい操作
      if (e?.response?.status === 403 && e?.response?.data?.error) {
        const needsAuth = (e.response.data as { code?: string }).code === 'strong_auth_required'
        if (needsAuth) {
          setPendingRole({ user, role })
          return
        }
      }
      setError(e?.response?.data?.error ?? '役割を変更できませんでした')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">利用者</h2>

      {/* 確かめが切れていたら、その場で確かめてから続きをやる。
          押し直させると、何をしようとしていたか忘れる */}
      {pendingRole && (
        <StrongAuthPrompt
          reason={`${pendingRole.user.email} の役割を「${ROLE_LABELS[pendingRole.role]}」に変えるため`}
          onDone={() => {
            const pending = pendingRole
            setPendingRole(null)
            void changeRole(pending.user, pending.role)
          }}
          onCancel={() => setPendingRole(null)}
        />
      )}

      {/* 期間は「いつ登録した人か」で絞る。伸びの数字（下）は全体のまま */}
      {page?.period && <PeriodSelect period={page.period} value={period} onChange={setPeriod} />}

      {/* 一覧は「いま誰がいるか」しか分からない。伸びているかは数字と推移で見る */}
      {page?.stats && <UserStats stats={page.stats} />}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmittedQuery(query.trim())
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="メールアドレス・名前で検索"
          aria-label="利用者を検索"
        />
        <Button type="submit" variant="outline" className="flex items-center gap-1.5">
          <Search size={15} />
          検索
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">メールアドレス</th>
              <th className="px-3 py-2 font-medium">役割</th>
              <th className="px-3 py-2 text-right font-medium">カード</th>
              <th className="px-3 py-2 text-right font-medium">残高</th>
              <th className="px-3 py-2 font-medium">プラン</th>
              <th className="px-3 py-2 font-medium">登録</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 size={16} className="mr-1 inline animate-spin" /> 読み込み中…
                </td>
              </tr>
            )}
            {!loading &&
              page?.users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="block truncate">{user.email}</span>
                    {user.name && <span className="block text-xs text-muted-foreground">{user.name}</span>}
                    {!user.confirmed && <span className="text-xs text-muted-foreground">未確認</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canChangeRole && !user.role_locked ? (
                      <select
                        value={confirming?.id === user.id ? confirming.role : user.role}
                        onChange={(e) => setConfirming({ id: user.id, role: e.target.value as AdminRole })}
                        disabled={busyId === user.id}
                        aria-label={`${user.email}の役割`}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{ROLE_LABELS[user.role]}</span>
                    )}
                    {user.role_locked && (
                      <span className="ml-1 text-xs text-muted-foreground">（環境変数で固定）</span>
                    )}
                    {confirming?.id === user.id && confirming.role !== user.role && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === user.id}
                        onClick={() => changeRole(user, confirming.role)}
                        className="ml-2"
                      >
                        {busyId === user.id ? '変更中…' : `${ROLE_LABELS[confirming.role]}にする（確定）`}
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{user.items.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{user.available_credits}</td>
                  <td className="px-3 py-2">{user.plan ?? '無料'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              ))}
            {!loading && page?.users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  該当する利用者がいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {page && page.meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page.meta.total_count.toLocaleString()} 人中 {page.meta.page} / {page.meta.total_pages} ページ
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page.meta.page <= 1 || loading}
              onClick={() => load(submittedQuery, page.meta.page - 1)}
            >
              前へ
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page.meta.page >= page.meta.total_pages || loading}
              onClick={() => load(submittedQuery, page.meta.page + 1)}
            >
              次へ
            </Button>
          </div>
        </div>
      )}

      {!canChangeRole && (
        <p className="text-xs text-muted-foreground">役割の変更は運営の管理者のみが行えます。</p>
      )}
    </section>
  )
}

// 利用者の総計と推移。棒の高さは月ごとの新規、線の位置は累計
function UserStats({ stats }: { stats: AdminUserStats }) {
  const peak = Math.max(1, ...stats.monthly.map((m) => m.count))

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="総数" value={stats.total} sub={`確認済み ${stats.confirmed} / 運営 ${stats.admins}`} />
        <Metric label="今月の新規" value={stats.new_this_month} />
        <Metric label="先月の新規" value={stats.new_last_month} />
        <Metric
          label="前月比"
          value={stats.growth_rate === null ? '—' : `${stats.growth_rate > 0 ? '+' : ''}${stats.growth_rate}%`}
          sub={stats.growth_rate === null ? '先月の新規が0のため出せない' : undefined}
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground">月ごとの新規（12か月）</p>
        <div className="mt-2 flex h-24 items-end gap-1">
          {stats.monthly.map((m) => (
            <div key={m.month} className="group relative flex-1" title={`${m.month}: 新規 ${m.count} / 累計 ${m.cumulative}`}>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(2, (m.count / peak) * 100)}%`,
                  backgroundColor: 'var(--palace)',
                  opacity: m.count === 0 ? 0.25 : 0.85,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-2xs text-muted-foreground">
          <span>{stats.monthly[0]?.month}</span>
          <span>累計 {stats.monthly[stats.monthly.length - 1]?.cumulative ?? stats.total}</span>
          <span>{stats.monthly[stats.monthly.length - 1]?.month}</span>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
