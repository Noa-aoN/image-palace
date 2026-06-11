'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getItems } from '@/lib/api/items'
import { getCollections, getCollection } from '@/lib/api/collections'
import type { Item } from '@/types/item'
import type { Collection } from '@/types/collection'

// 「すべてのカード」を表す擬似コレクションID
const ALL = 'all'

function LibraryCard({ item }: { item: Item }) {
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-muted-foreground text-xs px-2 text-center">{item.title}</span>
        )}
      </div>
      <div className="px-3 py-2">
        <span className="text-sm font-medium truncate block">{item.title}</span>
      </div>
    </Link>
  )
}

export default function LibraryPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollection, setActiveCollection] = useState<string>(ALL)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  // コレクション一覧（フィルタ用）
  useEffect(() => {
    getCollections()
      .then(setCollections)
      .catch(() => {
        // フィルタは無くても致命的でないため握りつぶす
      })
  }, [])

  // フィルタ切り替え。再取得中はスケルトンを出すため loading を立てる
  const selectCollection = (id: string) => {
    if (id === activeCollection) return
    setLoading(true)
    setActiveCollection(id)
  }

  // 選択中のコレクション（すべて or 特定）に応じてカードを取得
  useEffect(() => {
    let cancelled = false
    const fetcher =
      activeCollection === ALL
        ? getItems()
        : getCollection(activeCollection).then((c) => c.items)

    fetcher
      .then((data) => {
        if (!cancelled) setItems(data)
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
  }, [activeCollection])

  // タイトルによるクライアント側絞り込み（サーバ検索は #106 で対応予定）
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [items, query])

  const chipBase = 'rounded-full px-3 py-1 text-sm whitespace-nowrap transition-colors border'
  const chipClass = (active: boolean) =>
    active
      ? `${chipBase} border-transparent text-white`
      : `${chipBase} border-border text-muted-foreground hover:bg-muted`

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-xl font-semibold mb-6">ライブラリ</h1>

      {/* 検索 */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カードのタイトルで絞り込む"
          aria-label="カード検索"
          className="pl-9"
        />
      </div>

      {/* コレクション別フィルタ */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        <button
          onClick={() => selectCollection(ALL)}
          className={chipClass(activeCollection === ALL)}
          style={activeCollection === ALL ? { backgroundColor: 'var(--palace)' } : undefined}
        >
          すべて
        </button>
        {collections.map((collection) => {
          const active = activeCollection === collection.id
          return (
            <button
              key={collection.id}
              onClick={() => selectCollection(collection.id)}
              className={chipClass(active)}
              style={active ? { backgroundColor: 'var(--palace)' } : undefined}
            >
              {collection.name}（{collection.item_count}）
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          {query.trim()
            ? '一致するカードがありません。'
            : 'カードがありません。'}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <LibraryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
