'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, GalleryHorizontal, Layers, LayoutGrid, Frame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getCollection, updateCollection, deleteCollection,
  addEntryToCollection, removeEntryFromCollection,
} from '@/lib/api/collections'
import { getItems } from '@/lib/api/items'
import { getDecks } from '@/lib/api/decks'
import { getSpaces } from '@/lib/api/spaces'
import { getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import type { CollectionDetail, CollectionEntry, CollectionEntryType } from '@/types/collection'

// 追加候補の正規化表現
type Pickable = { id: string; label: string; image: string | null; sub?: string }

const TYPE_META: Record<CollectionEntryType, { label: string; icon: React.ReactNode; path: string }> = {
  Item: { label: 'カード', icon: <GalleryHorizontal size={16} />, path: 'items' },
  Deck: { label: 'デッキ', icon: <Layers size={16} />, path: 'decks' },
  Space: { label: 'スペース', icon: <Frame size={16} />, path: 'spaces' },
  View: { label: 'ビュー', icon: <LayoutGrid size={16} />, path: 'views' },
}
const TYPE_ORDER: CollectionEntryType[] = ['Item', 'Deck', 'Space', 'View']

function entryHref(e: CollectionEntry): string {
  return `/${TYPE_META[e.entry_type].path}/${e.id}`
}
function entryLabel(e: CollectionEntry): string {
  return e.entry_type === 'Item' ? e.title : e.name
}
function entryImage(e: CollectionEntry): string | null {
  if (e.entry_type === 'Item') return e.media?.thumb_url ?? e.media?.url ?? null
  if (e.entry_type === 'Deck') return e.cover?.thumb_url ?? e.cover?.url ?? null
  return null
}

function EntryTile({ entry, onRemove, busy }: { entry: CollectionEntry; onRemove: () => void; busy: boolean }) {
  const image = entryImage(entry)
  const hasImage = entry.entry_type === 'Item' || entry.entry_type === 'Deck'
  const removeBtn = (
    <Button
      variant="destructive"
      size="icon-sm"
      onClick={onRemove}
      disabled={busy}
      aria-label="このエントリを外す"
      className="rounded-full shadow"
    >
      <X size={14} />
    </Button>
  )

  if (hasImage) {
    // デッキ等のカバーも含め、タイルは一律で正方形に揃える（生成画像・デッキページと同比率）
    const ratio = 'aspect-square'
    return (
      <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
        <div className={`relative w-full ${ratio} bg-muted overflow-hidden`}>
          <Link href={entryHref(entry)} className="flex h-full w-full items-center justify-center hover:opacity-95 transition-opacity">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={entryLabel(entry)} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-muted-foreground/60">{TYPE_META[entry.entry_type].icon}</span>
            )}
          </Link>
          <div className="absolute top-1 right-1 z-10">{removeBtn}</div>
        </div>
        <div className="px-3 py-2">
          <span className="text-sm font-medium truncate block">{entryLabel(entry)}</span>
        </div>
      </div>
    )
  }

  // スペース / ビュー（画像なし・行タイル）
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <Link href={entryHref(entry)} className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity">
        <span style={{ color: 'var(--palace)' }}>{TYPE_META[entry.entry_type].icon}</span>
        <span className="font-medium text-sm truncate">{entryLabel(entry)}</span>
      </Link>
      {removeBtn}
    </div>
  )
}

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [collection, setCollection] = useState<CollectionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [pickerType, setPickerType] = useState<CollectionEntryType | null>(null)
  const [pickables, setPickables] = useState<Pickable[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const reload = async () => {
    const data = await getCollection(id)
    setCollection(data)
  }

  useEffect(() => {
    let cancelled = false
    getCollection(id)
      .then((data) => {
        if (!cancelled) setCollection(data)
      })
      .catch(() => {
        if (!cancelled) setError('コレクションの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const openPicker = async (type: CollectionEntryType) => {
    setPickerType(type)
    setPickerLoading(true)
    try {
      let list: Pickable[] = []
      if (type === 'Item') {
        list = (await getItems()).map((i) => ({ id: i.id, label: i.title, image: i.media?.thumb_url ?? i.media?.url ?? null }))
      } else if (type === 'Deck') {
        list = (await getDecks()).map((d) => ({ id: d.id, label: d.name, image: d.cover?.thumb_url ?? d.cover?.url ?? null, sub: `${d.item_count}枚` }))
      } else if (type === 'Space') {
        list = (await getSpaces()).map((s) => ({ id: s.id, label: s.name, image: null }))
      } else {
        list = (await getViews()).map((v) => ({ id: v.id, label: v.name, image: null, sub: viewTypeLabel(v.view_type) }))
      }
      setPickables(list)
    } catch {
      setPickables([])
    } finally {
      setPickerLoading(false)
    }
  }

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !collection) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateCollection(id, { name: trimmed })
      setCollection({ ...collection, name: updated.name })
      setEditing(false)
    } catch {
      setError('コレクション名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteCollection(id)
      router.push('/collections')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleAdd = async (type: CollectionEntryType, entryId: string) => {
    setBusyKey(`${type}:${entryId}`)
    try {
      await addEntryToCollection(id, type, entryId)
      await reload()
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyKey(null)
    }
  }

  const handleRemove = async (entry: CollectionEntry) => {
    if (!collection) return
    setBusyKey(`${entry.entry_type}:${entry.id}`)
    try {
      await removeEntryFromCollection(id, entry.entry_type, entry.id)
      setCollection({
        ...collection,
        entries: collection.entries.filter((e) => !(e.entry_type === entry.entry_type && e.id === entry.id)),
        entry_count: Math.max(collection.entry_count - 1, 0),
      })
    } catch {
      setError('除外に失敗しました')
    } finally {
      setBusyKey(null)
    }
  }

  if (error && !collection) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/collections"><Button variant="outline">← コレクション一覧へ</Button></Link>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const inCollection = new Set(collection.entries.map((e) => `${e.entry_type}:${e.id}`))
  const pickable = pickerType
    ? pickables.filter((p) => !inCollection.has(`${pickerType}:${p.id}`))
    : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Link href="/collections">
        <Button variant="ghost" className="text-sm px-0 mb-4">← コレクション一覧へ</Button>
      </Link>

      <div className="flex items-center justify-between gap-3 mb-2">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveName() } if (e.key === 'Escape') setEditing(false) }}
              disabled={saving}
              autoFocus
              aria-label="コレクション名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{collection.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{collection.entry_count} 件</span>
            <button
              onClick={() => { setNameDraft(collection.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="コレクション名を編集"
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
      <p className="text-sm text-muted-foreground mb-6">
        カード・デッキ・スペース・ビューをまとめられます。
      </p>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* 追加（種別を選んでから対象を選ぶ） */}
      <div className="mb-8 rounded-xl border border-border/70 bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-1 flex items-center gap-1"><Plus size={14} />追加:</span>
          {TYPE_ORDER.map((type) => (
            <Button
              key={type}
              variant={pickerType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => openPicker(type)}
              className="flex items-center gap-1.5"
            >
              {TYPE_META[type].icon}
              {TYPE_META[type].label}
            </Button>
          ))}
          {pickerType && (
            <Button variant="ghost" size="sm" onClick={() => setPickerType(null)} className="ml-auto">閉じる</Button>
          )}
        </div>

        {pickerType && (
          <div className="mt-4">
            {pickerLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : pickable.length === 0 ? (
              <p className="text-sm text-muted-foreground">追加できる{TYPE_META[pickerType].label}がありません。</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {pickable.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-card border border-border px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                      ) : (
                        <span className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0" style={{ color: 'var(--palace)' }}>
                          {TYPE_META[pickerType].icon}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{p.label}</span>
                        {p.sub && <span className="text-xs text-muted-foreground">{p.sub}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(pickerType, p.id)}
                      disabled={busyKey === `${pickerType}:${p.id}`}
                      className="shrink-0"
                    >
                      追加
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* エントリ（種別ごとに表示） */}
      {collection.entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          まだ何もありません。上の「追加」からまとめましょう。
        </p>
      ) : (
        <div className="space-y-8">
          {TYPE_ORDER.map((type) => {
            const entries = collection.entries.filter((e) => e.entry_type === type)
            if (entries.length === 0) return null
            const grid = type === 'Item' || type === 'Deck'
            return (
              <section key={type} className="space-y-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <span style={{ color: 'var(--palace)' }}>{TYPE_META[type].icon}</span>
                  {TYPE_META[type].label}
                  <span className="text-sm font-normal text-muted-foreground">{entries.length}</span>
                </h2>
                <div className={grid ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
                  {entries.map((entry) => (
                    <EntryTile
                      key={`${entry.entry_type}:${entry.id}`}
                      entry={entry}
                      onRemove={() => handleRemove(entry)}
                      busy={busyKey === `${entry.entry_type}:${entry.id}`}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
