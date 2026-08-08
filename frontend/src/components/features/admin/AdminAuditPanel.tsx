'use client'

import { useEffect, useState } from 'react'
import { getAdminAuditLogs } from '@/lib/api/admin'
import type { AdminAuditLog } from '@/types/admin'

/**
 * 管理操作の記録。
 *
 * 権限の付け外しは、後から「誰がいつ何をしたか」を辿れないと事故のときに何も分からない。
 * 読むだけで、消したり書き換えたりはできない。
 */
export function AdminAuditPanel() {
  const [logs, setLogs] = useState<AdminAuditLog[] | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [actors, setActors] = useState<string[]>([])
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')

  useEffect(() => {
    let cancelled = false
    getAdminAuditLogs({ action_name: action || undefined, actor: actor || undefined })
      .then((page) => {
        if (cancelled) return
        setLogs(page.logs)
        // 選択肢は絞り込みの影響を受けない（全体から拾う）
        setActions(page.actions)
        setActors(page.actors)
      })
      .catch(() => {
        if (!cancelled) setLogs([])
      })
    return () => {
      cancelled = true
    }
  }, [action, actor])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">管理操作の記録</h2>
        {/* 操作の種類が増えたので、種類と実行者で絞れるようにする */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label="操作の種類で絞り込む"
            className="rounded-lg border border-border bg-background px-2 py-1"
          >
            <option value="">すべての操作</option>
            {actions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            aria-label="実行者で絞り込む"
            className="rounded-lg border border-border bg-background px-2 py-1"
          >
            <option value="">すべての実行者</option>
            {actors.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
          {(action || actor) && (
            <button
              type="button"
              onClick={() => {
                setAction('')
                setActor('')
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              解除
            </button>
          )}
        </div>
      </div>
      {logs === null ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {action || actor ? '条件に合う記録はありません。' : 'まだ記録はありません。'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {logs.map((log) => (
            <li key={log.id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {log.actor_email ?? '（退会済み）'}
                {log.target_type && <> → {log.target_type}</>}
                {Object.keys(log.details).length > 0 && <> / {JSON.stringify(log.details)}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
