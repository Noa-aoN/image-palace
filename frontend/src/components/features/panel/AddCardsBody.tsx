'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getItemsPage } from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import { getViewDetail } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { Item } from '@/types/item'
import type { Tag } from '@/types/tag'

// 右パネル: ボードに追加できるカードを検索・タグ絞り込みして選ぶ。
// クリックは requestAdd でボード側に通知し、ボードが中央に配置する（座標計算はボードが持つため）。
export function AddCardsBody({ viewId }: { viewId: string }) {
  const requestAdd = useRightPanelStore((s) => s.requestAdd)
  const [items, setItems] = useState<Item[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTags().then(setTags).catch(() => {})
  }, [])

  // 配置済みカード（一覧から除外する）
  useEffect(() => {
    getViewDetail(viewId)
      .then((v) => setPlacedIds(new Set((v.items ?? []).map((i) => i.item_id))))
      .catch(() => {})
  }, [viewId])

  // フリーワードはデバウンスして反映
  useEffect(() => {
    const handle = setTimeout(() => setAppliedQuery(query.trim()), 300)
    return () => clearTimeout(handle)
  }, [query])

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

  const handleAdd = (item: Item) => {
    // 楽観的に一覧から消し、重複クリックを防ぐ
    setPlacedIds((prev) => new Set(prev).add(item.id))
    requestAdd(item)
  }

  return (
    <div className="space-y-3">
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
                onClick={() => handleAdd(item)}
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
  )
}
