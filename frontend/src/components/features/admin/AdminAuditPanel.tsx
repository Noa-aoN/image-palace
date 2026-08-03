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

  useEffect(() => {
    getAdminAuditLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
  }, [])

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">管理操作の記録</h2>
      {logs === null ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだ記録はありません。</p>
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
