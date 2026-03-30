'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getItem } from '@/lib/api/items'
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

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getItem(id)
      .then(setItem)
      .catch(() => setError('カードの取得に失敗しました'))
  }, [id])

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/items"><Button variant="outline">← マイカードへ戻る</Button></Link>
      </div>
    )
  }

  if (!item) {
    return <p className="max-w-lg mx-auto px-6 py-12 text-muted-foreground text-sm">読み込み中...</p>
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-12 space-y-6">
      <Link href="/items">
        <Button variant="ghost" className="text-sm px-0">← マイカードへ戻る</Button>
      </Link>

      {item.media?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.media.url}
          alt={item.title}
          className="w-full rounded-xl object-cover"
        />
      ) : (
        <div className="w-full aspect-square rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-sm">
          {STATUS_LABEL[item.generation_status] ?? item.generation_status}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}>
          {STATUS_LABEL[item.generation_status] ?? item.generation_status}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        作成日: {new Date(item.created_at).toLocaleDateString('ja-JP')}
      </p>
    </div>
  )
}
