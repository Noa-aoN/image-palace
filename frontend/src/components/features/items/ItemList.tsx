'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getItems } from '@/lib/api/items'
import type { Item } from '@/types/item'

const STATUS_LABEL: Record<string, string> = {
  pending: '生成待ち',
  processing: '生成中',
  completed: '完了',
  failed: '失敗',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function ItemCard({ item }: { item: Item }) {
  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
      <div className="relative w-full aspect-square bg-muted">
        {item.media?.url ? (
          <Image
            src={item.media.url}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            {STATUS_LABEL[item.generation_status] ?? item.generation_status}
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{item.title}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}
        >
          {STATUS_LABEL[item.generation_status] ?? item.generation_status}
        </span>
      </div>
    </div>
  )
}

export function ItemList() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getItems()
      .then(setItems)
      .catch(() => setError('カードの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-muted-foreground text-sm">読み込み中...</p>
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">カードはまだありません</p>
        <Link href="/items/new">
          <Button>最初のカードを作成する</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  )
}
