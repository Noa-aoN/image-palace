'use client'

import { useEffect, useState } from 'react'
import { getViewDetail } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { ViewItemPlacement } from '@/types/view'

// 右パネル: ボードに配置済みのカード一覧。クリックで詳細を開き、ボードを該当カードへパンする。
export function BoardCardsList({ viewId }: { viewId: string }) {
  const openCard = useRightPanelStore((s) => s.openCard)
  const requestFocus = useRightPanelStore((s) => s.requestFocus)
  const [items, setItems] = useState<ViewItemPlacement[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getViewDetail(viewId)
      .then((v) => {
        if (!cancelled) setItems(v.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [viewId])

  if (items === null) return <p className="text-xs text-muted-foreground">読み込み中…</p>
  if (items.length === 0) return <p className="text-xs text-muted-foreground">まだカードがありません。</p>

  const select = (itemId: string) => {
    openCard(itemId, viewId)
    requestFocus(itemId)
  }

  return (
    <ul className="space-y-1.5">
      {items.map((vi) => {
        const url = vi.item.media?.thumb_url ?? vi.item.media?.url ?? null
        return (
          <li key={vi.item_id}>
            <button
              type="button"
              onClick={() => select(vi.item_id)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-1.5 text-left transition-colors hover:bg-muted"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={vi.item.title} className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm">{vi.item.title}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
