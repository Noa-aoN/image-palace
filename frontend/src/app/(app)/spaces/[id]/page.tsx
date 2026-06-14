'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, Layers, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getSpace,
  updateSpace,
  deleteSpace,
  addCollectionToSpace,
  removeCollectionFromSpace,
  addSpacePoint,
  updateSpacePoint,
  removeSpacePoint,
  reorderSpacePoints,
} from '@/lib/api/spaces'
import { getCollections } from '@/lib/api/collections'
import { getItemsPage } from '@/lib/api/items'
import { spaceTypeLabel } from '@/lib/space-types'
import type { SpaceDetail, SpaceCollectionRef, SpacePoint } from '@/types/space'
import type { Collection } from '@/types/collection'
import type { Item } from '@/types/item'

// road 種別: カード割当の検索ピッカー（モーダル）
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

function PointBody({ item }: { item: SpacePoint['item'] }) {
  if (!item) return <span className="text-sm text-muted-foreground">空（カード未割当）</span>
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

export default function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [space, setSpace] = useState<SpaceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // room
  const [picking, setPicking] = useState(false)
  const [allCollections, setAllCollections] = useState<Collection[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  // road
  const [pickerPointId, setPickerPointId] = useState<string | null>(null)
  const [busyPoint, setBusyPoint] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSpace(id)
      .then((data) => {
        if (!cancelled) setSpace(data)
      })
      .catch(() => {
        if (!cancelled) setError('スペースの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const setCollections = useCallback((updater: (cs: SpaceCollectionRef[]) => SpaceCollectionRef[]) => {
    setSpace((prev) => (prev ? { ...prev, collections: updater(prev.collections ?? []) } : prev))
  }, [])
  const setPoints = useCallback((updater: (ps: SpacePoint[]) => SpacePoint[]) => {
    setSpace((prev) => (prev ? { ...prev, points: updater(prev.points ?? []) } : prev))
  }, [])

  const startEdit = () => {
    if (!space) return
    setNameDraft(space.name)
    setDescDraft(space.description ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !space) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateSpace(id, { name: trimmed, description: descDraft.trim() })
      setSpace((prev) => (prev ? { ...prev, name: updated.name, description: updated.description } : prev))
      setEditing(false)
    } catch {
      setError('スペースの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteSpace(id)
      router.push('/spaces')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // --- room: collections ---
  const openPicker = async () => {
    setPicking(true)
    if (allCollections.length === 0) {
      try {
        setAllCollections(await getCollections())
      } catch {
        // 取得失敗時は空表示
      }
    }
  }
  const handleAddCollection = async (collection: Collection) => {
    setBusyId(collection.id)
    try {
      await addCollectionToSpace(id, collection.id)
      setCollections((cs) => [
        { id: collection.id, name: collection.name, description: collection.description, entry_count: collection.entry_count },
        ...cs,
      ])
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyId(null)
    }
  }
  const handleRemoveCollection = async (collectionId: string) => {
    setBusyId(collectionId)
    try {
      await removeCollectionFromSpace(id, collectionId)
      setCollections((cs) => cs.filter((c) => c.id !== collectionId))
    } catch {
      setError('除外に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  // --- road: points ---
  const handleAddPoint = async () => {
    setBusyPoint(true)
    try {
      const point = await addSpacePoint(id)
      setPoints((ps) => [...ps, point])
    } catch {
      setError('ポイントの追加に失敗しました')
    } finally {
      setBusyPoint(false)
    }
  }
  const handleAssign = async (item: Item) => {
    const pointId = pickerPointId
    if (!pointId) return
    setPickerPointId(null)
    try {
      const updated = await updateSpacePoint(id, pointId, { item_id: item.id })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードの割り当てに失敗しました')
    }
  }
  const handleClearPoint = async (pointId: string) => {
    try {
      const updated = await updateSpacePoint(id, pointId, { item_id: null })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードのクリアに失敗しました')
    }
  }
  const handleRemovePoint = async (pointId: string) => {
    setPoints((ps) => ps.filter((p) => p.id !== pointId))
    try {
      await removeSpacePoint(id, pointId)
    } catch {
      setError('ポイントの削除に失敗しました')
    }
  }
  const movePoint = async (index: number, dir: -1 | 1) => {
    if (!space?.points) return
    const target = index + dir
    if (target < 0 || target >= space.points.length) return
    const next = [...space.points]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPoints(() => next)
    try {
      await reorderSpacePoints(id, next.map((p) => p.id))
    } catch {
      setError('並び替えに失敗しました')
    }
  }

  if (error && !space) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/spaces"><Button variant="outline">← スペース一覧へ</Button></Link>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-20 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  const collections = space.collections ?? []
  const points = space.points ?? []
  const placedCollectionIds = new Set(collections.map((c) => c.id))
  const pickable = allCollections.filter((c) => !placedCollectionIds.has(c.id))

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/spaces">
        <Button variant="ghost" className="text-sm px-0 mb-4">← スペース一覧へ</Button>
      </Link>

      {editing ? (
        <div className="space-y-3 mb-8">
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} disabled={saving} autoFocus aria-label="スペース名" className="text-lg" />
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            disabled={saving}
            rows={3}
            placeholder="説明（任意）"
            aria-label="スペースの説明"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5"><Check size={14} />保存</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1.5"><X size={14} />キャンセル</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold truncate">{space.name}</h1>
              <span className="text-sm text-muted-foreground shrink-0">{spaceTypeLabel(space.space_type)}</span>
              <button onClick={startEdit} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-label="スペースを編集">
                <Pencil size={16} />
              </button>
            </div>
            {space.description && (
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{space.description}</p>
            )}
          </div>
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
      )}

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {space.space_type === 'road' ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            序数のあるポイントを並べ、各点にカードを割り当てます（連結法/ジャーニー法）。
          </p>
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">まだポイントがありません。「ポイントを追加」で順路の点を作りましょう。</p>
          ) : (
            <ol className="space-y-2">
              {points.map((point, index) => (
                <li key={point.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: 'var(--palace)' }}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1"><PointBody item={point.item} /></div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPickerPointId(point.id)}>
                      {point.item ? '変更' : 'カードを割当'}
                    </Button>
                    {point.item && <Button variant="ghost" size="sm" onClick={() => handleClearPoint(point.id)}>クリア</Button>}
                    <button onClick={() => movePoint(index, -1)} disabled={index === 0} aria-label="上へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp size={16} /></button>
                    <button onClick={() => movePoint(index, 1)} disabled={index === points.length - 1} aria-label="下へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown size={16} /></button>
                    <button onClick={() => handleRemovePoint(point.id)} aria-label="ポイントを削除" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="pt-1">
            <Button variant="outline" size="sm" onClick={handleAddPoint} disabled={busyPoint} className="flex items-center gap-1.5">
              <Plus size={14} />ポイントを追加
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">コレクション</h2>
            {!picking && (
              <Button variant="outline" size="sm" onClick={openPicker} className="flex items-center gap-1.5">
                <Plus size={14} />コレクションを配置
              </Button>
            )}
          </div>

          {picking && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">配置するコレクションを選択</span>
                <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>閉じる</Button>
              </div>
              {pickable.length === 0 ? (
                <p className="text-sm text-muted-foreground">配置できるコレクションがありません。</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pickable.map((collection) => (
                    <div key={collection.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers size={16} style={{ color: 'var(--palace)' }} />
                        <span className="font-medium text-sm truncate">{collection.name}</span>
                      </div>
                      <Button size="icon-sm" onClick={() => handleAddCollection(collection)} disabled={busyId === collection.id} aria-label="配置" className="rounded-full shrink-0">
                        <Plus size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">まだコレクションが配置されていません。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {collections.map((collection) => (
                <div key={collection.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                  <Link href={`/collections/${collection.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers size={16} style={{ color: 'var(--palace)' }} />
                      <div className="min-w-0">
                        <span className="font-medium text-sm truncate block">{collection.name}</span>
                        <span className="text-xs text-muted-foreground">{collection.entry_count} 件</span>
                      </div>
                    </div>
                  </Link>
                  <Button variant="destructive" size="icon-sm" onClick={() => handleRemoveCollection(collection.id)} disabled={busyId === collection.id} aria-label="外す" className="rounded-full shrink-0">
                    <X size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {pickerPointId && <AssignCardModal onSelect={handleAssign} onClose={() => setPickerPointId(null)} />}
    </div>
  )
}
