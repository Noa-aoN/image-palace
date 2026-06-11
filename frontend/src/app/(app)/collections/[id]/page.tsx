'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCollection, updateCollection, deleteCollection, addItemToCollection, removeItemFromCollection } from '@/lib/api/collections'
import { getItems } from '@/lib/api/items'
import type { CollectionDetail } from '@/types/collection'
import type { Item } from '@/types/item'

function ItemThumb({ item, action }: { item: Item; action: React.ReactNode }) {
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
      <div className="relative w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-muted-foreground text-xs px-2 text-center">{item.title}</span>
        )}
        <div className="absolute top-1 right-1">{action}</div>
      </div>
      <div className="px-3 py-2">
        <span className="text-sm font-medium truncate block">{item.title}</span>
      </div>
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

  const [picking, setPicking] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

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

  const openPicker = async () => {
    setPicking(true)
    if (allItems.length === 0) {
      try {
        setAllItems(await getItems())
      } catch {
        // 取得失敗時はピッカーを空表示にする
      }
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

  const handleAdd = async (item: Item) => {
    if (!collection) return
    setBusyItemId(item.id)
    try {
      await addItemToCollection(id, item.id)
      setCollection({
        ...collection,
        items: [item, ...collection.items],
        item_count: collection.item_count + 1,
      })
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyItemId(null)
    }
  }

  const handleRemove = async (item: Item) => {
    if (!collection) return
    setBusyItemId(item.id)
    try {
      await removeItemFromCollection(id, item.id)
      setCollection({
        ...collection,
        items: collection.items.filter((i) => i.id !== item.id),
        item_count: Math.max(collection.item_count - 1, 0),
      })
    } catch {
      setError('削除に失敗しました')
    } finally {
      setBusyItemId(null)
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
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const inCollectionIds = new Set(collection.items.map((i) => i.id))
  const pickableItems = allItems.filter((i) => !inCollectionIds.has(i.id))

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/collections">
        <Button variant="ghost" className="text-sm px-0 mb-4">← コレクション一覧へ</Button>
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
              aria-label="コレクション名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{collection.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{collection.item_count} 枚</span>
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

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="mb-6">
        {!picking ? (
          <Button variant="outline" size="sm" onClick={openPicker} className="flex items-center gap-1.5">
            <Plus size={16} />
            カードを追加
          </Button>
        ) : (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">追加するカードを選択</span>
              <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>閉じる</Button>
            </div>
            {pickableItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">追加できるカードがありません。</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pickableItems.map((item) => (
                  <ItemThumb
                    key={item.id}
                    item={item}
                    action={
                      <Button
                        size="icon-sm"
                        onClick={() => handleAdd(item)}
                        disabled={busyItemId === item.id}
                        aria-label="このカードを追加"
                        className="rounded-full shadow"
                      >
                        <Plus size={14} />
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {collection.items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          まだカードがありません。「カードを追加」から追加してください。
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {collection.items.map((item) => (
            <ItemThumb
              key={item.id}
              item={item}
              action={
                <Button
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => handleRemove(item)}
                  disabled={busyItemId === item.id}
                  aria-label="このカードを外す"
                  className="rounded-full shadow"
                >
                  <X size={14} />
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
