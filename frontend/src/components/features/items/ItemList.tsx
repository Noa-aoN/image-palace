'use client'

import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getItems } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
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

const POLLING_STATUSES = new Set(['pending', 'processing'])

function ItemCard({ item }: { item: Item }) {
  const router = useRouter()
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const isGenerating = POLLING_STATUSES.has(item.generation_status)
  const warmedRef = useRef(false)
  const imageUrl = item.media?.thumb_url ?? item.media?.url
  const resolvedImageUrl = imageUrl ?? null
  const hasImageError = resolvedImageUrl !== null && failedImageUrl === resolvedImageUrl

  const warmupDetail = () => {
    if (warmedRef.current) return
    warmedRef.current = true

    startTransition(() => {
      useItemsStore.getState().upsertItem(item)
      router.prefetch(`/items/${item.id}`)
    })
  }

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
      prefetch
      onMouseEnter={warmupDetail}
      onFocus={warmupDetail}
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {resolvedImageUrl && !hasImageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            onError={() => setFailedImageUrl(resolvedImageUrl)}
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-muted">
            {isGenerating && (
              <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_40%,rgba(255,255,255,0.14))]" />
            )}
            <span className="relative z-10 text-muted-foreground text-xs px-2 text-center">
              {hasImageError ? '期限切れ' : (STATUS_LABEL[item.generation_status] ?? item.generation_status)}
            </span>
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
    </Link>
  )
}

export function ItemList() {
  const items = useItemsStore((state) => state.items)
  const setItems = useItemsStore((state) => state.setItems)
  const [loading, setLoading] = useState(() => useItemsStore.getState().items.length === 0)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestInFlightRef = useRef(false)

  const fetchItems = useEffectEvent(async (): Promise<Item[] | null> => {
    if (requestInFlightRef.current) return null

    requestInFlightRef.current = true
    try {
      const fetched = await getItems()
      setItems(fetched)
      setError(null)
      return fetched
    } catch {
      setError('カードの取得に失敗しました')
      return null
    } finally {
      requestInFlightRef.current = false
    }
  })

  useEffect(() => {
    let cancelled = false

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const poll = async () => {
      const fetched = await fetchItems()
      if (cancelled) return

      const latestItems = fetched ?? useItemsStore.getState().items
      const hasPending = latestItems.some((item) => POLLING_STATUSES.has(item.generation_status))
      if (hasPending) {
        timerRef.current = setTimeout(poll, 3000)
      }
    }

    poll().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      clearTimer()
    }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden">
            <div className="w-full aspect-square bg-muted animate-pulse" />
            <div className="px-3 py-2">
              <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">まだカードがありません。単語を入れて、最初の記憶カードを作りましょう。</p>
        <div className="mx-auto max-w-md rounded-xl border border-border/70 bg-muted/40 px-4 py-4 text-left">
          <p className="text-sm font-medium">最初に試しやすい例</p>
          <p className="mt-2 text-sm text-muted-foreground">富士山、光合成、API、細胞分裂</p>
          <p className="mt-1 text-xs text-muted-foreground">具体的な単語から始めると、画像生成が安定しやすいです。</p>
        </div>
        <Link href="/items/new">
          <Button>カードを作成する</Button>
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
