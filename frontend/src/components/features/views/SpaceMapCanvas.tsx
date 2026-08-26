'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, X, Loader2, Play, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItemsPage } from '@/lib/api/items'
import { placeCardOnPoint, clearPointPlacement } from '@/lib/api/views'
import type { SpaceMapPoint } from '@/types/view'
import type { Item } from '@/types/item'
import { SpaceWalkthrough } from '@/components/features/spaces/walkthrough/SpaceWalkthrough'
import { stopsFromSpaceMapPoints } from '@/components/features/spaces/walkthrough/constants'
import { PointDetailModal } from '@/components/features/spaces/walkthrough/PointDetailModal'
import { resolveRoomStyle } from '@/lib/room-style'
import type { RoomStyleOverrides } from '@/types/space'

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
                        <span className="px-1 text-center text-3xs text-muted-foreground">{item.title}</span>
                      )}
                    </div>
                    <span className="truncate px-1.5 py-1 text-2xs font-medium">{item.title}</span>
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

// ロキ画像 / 配置カードを対等に並べる正方形タイル（56px）。
function MapTile({
  imageUrl,
  alt,
  generating,
  kind,
}: {
  imageUrl: string | null
  alt: string
  generating?: boolean
  kind: 'loci' | 'card'
}) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : generating ? (
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      ) : kind === 'loci' ? (
        <Route size={18} className="text-muted-foreground/60" />
      ) : (
        <span className="px-1 text-center text-[8px] text-muted-foreground">未配置</span>
      )}
    </div>
  )
}

export function SpaceMapCanvas({
  viewId,
  space,
  initialPoints,
}: {
  viewId: string
  space: { id: string; name: string; space_type: string; room_style?: string; style_overrides?: RoomStyleOverrides } | null | undefined
  initialPoints: SpaceMapPoint[]
}) {
  const [points, setPoints] = useState<SpaceMapPoint[]>(initialPoints)
  // 毎レンダリングで作り直さない（ウォークスルー側のテクスチャ再生成を防ぐ）
  const mapRoomStyle = useMemo(
    () => resolveRoomStyle(space),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [space?.room_style, space?.style_overrides]
  )
  const [pickerPointId, setPickerPointId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

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
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          スペース「{space.name}」のポイントにカードを配置します。各ポイントの loci 画像を手掛かりに記憶を結び付けましょう。同じカードは複数のポイントに置けます。
        </p>
        <Button
          size="sm"
          onClick={() => setPlayerOpen(true)}
          disabled={points.length === 0}
          className="flex shrink-0 items-center gap-1.5"
          aria-label="ウォークスルーを再生"
        >
          <Play size={14} />
          ウォークスルー
        </Button>
      </div>
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
              {/* ロキ ＋ カード（対等に並べる・クリックで詳細） */}
              <button
                type="button"
                onClick={() => setDetailIndex(index)}
                aria-label={`${point.name || 'ポイント'} の詳細`}
                className="flex shrink-0 items-center gap-2 rounded-lg p-0.5 transition-colors hover:bg-muted/50"
              >
                <MapTile
                  imageUrl={point.image?.thumb_url ?? point.image?.url ?? null}
                  alt={point.name ?? 'ロキ画像'}
                  generating={!point.image && !!point.name && POLLING_STATUSES.has(point.generation_status)}
                  kind="loci"
                />
                <span className="select-none text-lg font-light text-muted-foreground">＋</span>
                <MapTile
                  imageUrl={point.placed_item?.media?.thumb_url ?? point.placed_item?.media?.url ?? null}
                  alt={point.placed_item?.title ?? 'カード'}
                  kind="card"
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{point.name || '（名前なし）'}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {point.placed_item ? point.placed_item.title : 'カード未配置'}
                  </span>
                  {(occurrence.get(point.space_point_id) ?? 0) >= 2 && (
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-3xs font-medium"
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
      {playerOpen && (
        <SpaceWalkthrough
          stops={stopsFromSpaceMapPoints(points)}
          title={space.name}
          spaceType={space.space_type}
          style={mapRoomStyle}
          dims={{ width: 4, height: 2.6, depth: 4 }}
          onClose={() => setPlayerOpen(false)}
        />
      )}
      {detailIndex !== null && (
        <PointDetailModal
          stops={stopsFromSpaceMapPoints(points)}
          index={detailIndex}
          onIndex={setDetailIndex}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </div>
  )
}
