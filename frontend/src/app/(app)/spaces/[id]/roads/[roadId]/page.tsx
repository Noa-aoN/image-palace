'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getRoad,
  updateRoad,
  deleteRoad,
  addRoadPoint,
  updateRoadPoint,
  removeRoadPoint,
  reorderRoadPoints,
} from '@/lib/api/roads'
import { getItemsPage } from '@/lib/api/items'
import type { RoadDetail, RoadPoint } from '@/types/road'
import type { Item } from '@/types/item'

function PointCard({ item }: { item: RoadPoint['item'] }) {
  if (!item) {
    return <span className="text-sm text-muted-foreground">空（カード未割当）</span>
  }
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="px-1 text-center text-[9px] text-muted-foreground">{item.title}</span>
        )}
      </div>
      <span className="truncate text-sm font-medium">{item.title}</span>
    </div>
  )
}

// カード割当用の検索ピッカー（モーダル）
function AssignCardModal({ onSelect, onClose }: { onSelect: (item: Item) => void; onClose: () => void }) {
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
          <span className="text-sm font-medium">カードを割り当て</span>
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

export default function RoadDetailPage() {
  const { id: spaceId, roadId } = useParams<{ id: string; roadId: string }>()
  const router = useRouter()

  const [road, setRoad] = useState<RoadDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [pickerPointId, setPickerPointId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRoad(spaceId, roadId)
      .then((data) => {
        if (!cancelled) setRoad(data)
      })
      .catch(() => {
        if (!cancelled) setError('ロードの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [spaceId, roadId])

  const setPoints = useCallback((updater: (points: RoadPoint[]) => RoadPoint[]) => {
    setRoad((prev) => (prev ? { ...prev, points: updater(prev.points) } : prev))
  }, [])

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !road) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateRoad(spaceId, roadId, { name: trimmed })
      setRoad((prev) => (prev ? { ...prev, name: updated.name } : prev))
      setEditing(false)
    } catch {
      setError('ロード名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteRoad(spaceId, roadId)
      router.push(`/spaces/${spaceId}`)
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleAddPoint = async () => {
    setBusy(true)
    try {
      const point = await addRoadPoint(spaceId, roadId)
      setPoints((points) => [...points, point])
    } catch {
      setError('ポイントの追加に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const handleAssign = async (item: Item) => {
    const pointId = pickerPointId
    if (!pointId) return
    setPickerPointId(null)
    try {
      const updated = await updateRoadPoint(spaceId, roadId, pointId, { item_id: item.id })
      setPoints((points) => points.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードの割り当てに失敗しました')
    }
  }

  const handleClear = async (pointId: string) => {
    try {
      const updated = await updateRoadPoint(spaceId, roadId, pointId, { item_id: null })
      setPoints((points) => points.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードのクリアに失敗しました')
    }
  }

  const handleRemovePoint = async (pointId: string) => {
    setPoints((points) => points.filter((p) => p.id !== pointId))
    try {
      await removeRoadPoint(spaceId, roadId, pointId)
    } catch {
      setError('ポイントの削除に失敗しました')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (!road) return
    const target = index + dir
    if (target < 0 || target >= road.points.length) return
    const next = [...road.points]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPoints(() => next)
    try {
      await reorderRoadPoints(spaceId, roadId, next.map((p) => p.id))
    } catch {
      setError('並び替えに失敗しました')
    }
  }

  if (error && !road) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href={`/spaces/${spaceId}`}><Button variant="outline">← スペースへ</Button></Link>
      </div>
    )
  }

  if (!road) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href={`/spaces/${spaceId}`}>
        <Button variant="ghost" className="text-sm px-0 mb-4">← スペースへ</Button>
      </Link>

      <div className="flex items-center justify-between gap-3 mb-6">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveName() } if (e.key === 'Escape') setEditing(false) }}
              disabled={saving}
              autoFocus
              aria-label="ロード名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{road.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">ロード</span>
            <button
              onClick={() => { setNameDraft(road.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="ロード名を編集"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
        <Button
          variant={confirmDelete ? 'destructive' : 'ghost'}
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          onBlur={() => setConfirmDelete(false)}
          className="flex items-center gap-1.5 shrink-0"
        >
          <Trash2 size={14} />
          {deleting ? '削除中...' : confirmDelete ? '本当に削除' : '削除'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <p className="mb-4 text-sm text-muted-foreground">
        序数のあるポイントを並べ、各点にカードを割り当てます（連結法/ジャーニー法）。
      </p>

      {road.points.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          まだポイントがありません。「ポイントを追加」で順路の点を作りましょう。
        </p>
      ) : (
        <ol className="space-y-2">
          {road.points.map((point, index) => (
            <li
              key={point.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--palace)' }}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <PointCard item={point.item} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPickerPointId(point.id)}>
                  {point.item ? '変更' : 'カードを割当'}
                </Button>
                {point.item && (
                  <Button variant="ghost" size="sm" onClick={() => handleClear(point.id)}>クリア</Button>
                )}
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="上へ"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === road.points.length - 1}
                  aria-label="下へ"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  onClick={() => handleRemovePoint(point.id)}
                  aria-label="ポイントを削除"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={handleAddPoint} disabled={busy} className="flex items-center gap-1.5">
          <Plus size={14} />
          ポイントを追加
        </Button>
      </div>

      {pickerPointId && <AssignCardModal onSelect={handleAssign} onClose={() => setPickerPointId(null)} />}
    </div>
  )
}
