'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminUsers, updateAdminUserRole } from '@/lib/api/admin'
import type { AdminRole, AdminUser, AdminUsersPage } from '@/types/admin'

const ROLE_LABELS: Record<AdminRole, string> = {
  user: '一般',
  admin: '運営',
  owner: '運営の管理者',
}

const ROLES: AdminRole[] = ['user', 'admin', 'owner']

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

  const load = useCallback(async (q: string, pageNumber = 1) => {
    setLoading(true)
    try {
      setPage(await getAdminUsers({ q: q || undefined, page: pageNumber }))
    } catch {
      setError('一覧を取得できませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(submittedQuery)
  }, [load, submittedQuery])

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
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '役割を変更できませんでした')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">利用者</h2>

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
