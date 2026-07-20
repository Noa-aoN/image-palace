'use client'

import { useEffect, useState } from 'react'
import { Spline } from 'lucide-react'
import { getViewDetail } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { ViewEdge } from '@/types/view'

// 右パネル: ボード上のオブジェクト（接続線・将来の図形/テキスト）一覧。
// クリックでそれぞれの設定へ（接続線 → edge 編集）。
export function ObjectList({ viewId }: { viewId: string }) {
  const openEdge = useRightPanelStore((s) => s.openEdge)
  const [edges, setEdges] = useState<ViewEdge[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getViewDetail(viewId)
      .then((v) => {
        if (!cancelled) setEdges(v.edges ?? [])
      })
      .catch(() => {
        if (!cancelled) setEdges([])
      })
    return () => {
      cancelled = true
    }
  }, [viewId])

  if (edges === null) return <p className="text-xs text-muted-foreground">読み込み中…</p>
  if (edges.length === 0) {
    return <p className="text-xs text-muted-foreground">まだオブジェクトがありません。カード同士をつないで接続線を作れます。</p>
  }

  return (
    <ul className="space-y-1.5">
      {edges.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => openEdge(viewId, e)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:bg-muted"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"
              style={{ color: e.style?.color || 'var(--foreground)' }}
            >
              <Spline size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{e.label?.trim() || '接続線'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
