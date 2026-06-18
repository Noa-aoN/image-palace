'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { getItemsPage } from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import type { Item } from '@/types/item'
import type { Tag } from '@/types/tag'

type AddCardsPanelProps = {
  placedIds: Set<string>
  onAdd: (item: Item) => void
  onClose: () => void
}

export function AddCardsPanel({ placedIds, onAdd, onClose }: AddCardsPanelProps) {
  const [items, setItems] = useState<Item[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // タグ一覧（絞り込み用）
  useEffect(() => {
    getTags().then(setTags).catch(() => {})
  }, [])

  // フリーワードはデバウンスして反映
  useEffect(() => {
    const handle = setTimeout(() => setAppliedQuery(query.trim()), 300)
    return () => clearTimeout(handle)
  }, [query])

  // 検索条件が変わるたびに取得（サーバー側の q / tag_id を利用）
  useEffect(() => {
    let cancelled = false
    getItemsPage(1, 50, { query: appliedQuery || undefined, tagId: activeTag ?? undefined })
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appliedQuery, activeTag])

  const available = useMemo(() => items.filter((i) => !placedIds.has(i.id)), [items, placedIds])

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 flex w-72 flex-col border-l border-border bg-card/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">カードを追加</span>
        <button type="button" onClick={onClose} aria-label="閉じる" className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      {/* 検索 */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="カードを検索"
            aria-label="カード検索"
            className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                activeTag === null ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              style={activeTag === null ? { backgroundColor: 'var(--palace)' } : undefined}
            >
              すべて
            </button>
            {tags.map((tag) => {
              const active = activeTag === tag.id
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setActiveTag(active ? null : tag.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                  style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 結果 */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">読み込み中…</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {appliedQuery || activeTag ? '条件に合うカードがありません。' : '追加できるカードがありません。'}
          </p>
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
                  <span className="truncate px-1.5 py-1 text-[11px] font-medium">{item.title}</span>
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="px-1 text-center text-[10px] text-muted-foreground">{item.title}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
