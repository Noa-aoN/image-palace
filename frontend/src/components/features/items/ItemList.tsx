'use client'

import { useEffect, useState } from 'react'
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
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between px-4 py-3 bg-card">
          <span className="font-medium text-sm">{item.title}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}
          >
            {STATUS_LABEL[item.generation_status] ?? item.generation_status}
          </span>
        </li>
      ))}
    </ul>
  )
}
