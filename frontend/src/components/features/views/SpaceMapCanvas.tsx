'use client'

import { useEffect, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItemsPage } from '@/lib/api/items'
import { placeCardOnPoint, clearPointPlacement } from '@/lib/api/views'
import type { SpaceMapPoint } from '@/types/view'
import type { Item } from '@/types/item'

const POLLING_STATUSES = new Set(['pending', 'processing'])

// 配置するカードの検索ピッカー（モーダル）
function CardPicker({ onSelect, onClose }: { onSelect: (item: Item) => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handle = setTimeout(() => setAppliedQuery(query.trim()), 300)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    let cancelled = false
    getItemsPage(1, 50, { query: appliedQuery || undefined })
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
  }, [appliedQuery])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">カードを配置</span>
          <button type="button" onClick={onClose} aria-label="閉じる" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="カードを検索"
              autoFocus
              aria-label="カード検索"
              className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">読み込み中…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground">カードがありません。</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => {
                const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
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
    </div>
  )
}

// ポイント自身の loci 画像（生成中はスピナー）
function LociImage({ point }: { point: SpaceMapPoint }) {
  const generating = !!point.name && POLLING_STATUSES.has(point.generation_status)
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={point.name ?? 'ポイント画像'} className="h-full w-full object-cover" loading="lazy" />
      ) : generating ? (
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      ) : (
        <span className="px-1 text-center text-[9px] text-muted-foreground">loci</span>
      )}
    </div>
  )
}

// 配置されたカード
function PlacedCard({ item }: { item: SpaceMapPoint['placed_item'] }) {
  if (!item) return <span className="text-xs text-muted-foreground">カード未配置</span>
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="px-0.5 text-center text-[8px] text-muted-foreground">{item.title}</span>
        )}
      </div>
      <span className="truncate text-sm font-medium">{item.title}</span>
    </div>
  )
}

export function SpaceMapCanvas({
  viewId,
  space,
  initialPoints,
}: {
  viewId: string
  space: { id: string; name: string; space_type: string } | null | undefined
  initialPoints: SpaceMapPoint[]
}) {
  const [points, setPoints] = useState<SpaceMapPoint[]>(initialPoints)
  const [pickerPointId, setPickerPointId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!space) {
    return (
      <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center gap-2 rounded-xl border border-border text-center">
        <p className="text-base font-medium">スペースが見つかりません</p>
        <p className="text-sm text-muted-foreground">配置先のスペースが削除された可能性があります。</p>
      </div>
    )
  }

  const handlePlace = async (item: Item) => {
    const pointId = pickerPointId
    if (!pointId) return
    setPickerPointId(null)
    try {
      const updated = await placeCardOnPoint(viewId, pointId, item.id)
      // 同じカードは複数ポイントに置ける（再利用可）。対象ポイントのみ更新する。
      setPoints((ps) => ps.map((p) => (p.space_point_id === pointId ? updated : p)))
    } catch {
      setError('カードの配置に失敗しました')
    }
  }

  const handleClear = async (pointId: string) => {
    try {
      await clearPointPlacement(viewId, pointId)
      setPoints((ps) => ps.map((p) => (p.space_point_id === pointId ? { ...p, placed_item: null } : p)))
    } catch {
      setError('配置のクリアに失敗しました')
    }
  }

  // 同じカードが複数ポイントに配置されているとき、2回目以降のポイントにバッジを出す
  const occurrence = new Map<string, number>()
  const seenCount = new Map<string, number>()
  points.forEach((p) => {
    if (!p.placed_item) return
    const n = (seenCount.get(p.placed_item.id) ?? 0) + 1
    seenCount.set(p.placed_item.id, n)
    occurrence.set(p.space_point_id, n)
  })

  return (
    <div className="flex-1">
      <p className="mb-3 text-sm text-muted-foreground">
        スペース「{space.name}」のポイントにカードを配置します。各ポイントの loci 画像を手掛かりに記憶を結び付けましょう。同じカードは複数のポイントに置けます。
      </p>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {points.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          このスペースにはポイントがありません。スペース詳細でポイントを追加してください。
        </p>
      ) : (
        <ol className="space-y-2">
          {points.map((point, index) => (
            <li key={point.space_point_id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--palace)' }}
              >
                {index + 1}
              </span>
              <LociImage point={point} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{point.name || '（名前なし）'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <PlacedCard item={point.placed_item} />
                  {(occurrence.get(point.space_point_id) ?? 0) >= 2 && (
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      style={{ borderColor: 'var(--palace)', color: 'var(--palace)' }}
                      title="このカードは複数のポイントに配置されています"
                    >
                      {occurrence.get(point.space_point_id)}回目
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPickerPointId(point.space_point_id)}>
                  {point.placed_item ? '変更' : 'カードを配置'}
                </Button>
                {point.placed_item && (
                  <Button variant="ghost" size="sm" onClick={() => handleClear(point.space_point_id)}>クリア</Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {pickerPointId && <CardPicker onSelect={handlePlace} onClose={() => setPickerPointId(null)} />}
    </div>
  )
}
