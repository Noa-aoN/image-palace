'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getItems } from '@/lib/api/items'
import type { Item } from '@/types/item'

type AddCardsPanelProps = {
  placedIds: Set<string>
  onAdd: (item: Item) => void
  onClose: () => void
}

export function AddCardsPanel({ placedIds, onAdd, onClose }: AddCardsPanelProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getItems()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const available = items.filter((i) => !placedIds.has(i.id))

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 flex w-64 flex-col border-l border-border bg-card/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">カードを追加</span>
        <button type="button" onClick={onClose} aria-label="閉じる" className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">読み込み中…</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-muted-foreground">追加できるカードがありません。</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {available.map((item) => {
              const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAdd(item)}
                  className="flex flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition-shadow hover:shadow-md"
                >
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="px-1 text-center text-[10px] text-muted-foreground">{item.title}</span>
                    )}
                  </div>
                  <span className="truncate px-1.5 py-1 text-[11px] font-medium">{item.title}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
