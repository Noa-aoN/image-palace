'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRoom, updateRoom, deleteRoom, addCollectionToRoom, removeCollectionFromRoom } from '@/lib/api/rooms'
import { getCollections } from '@/lib/api/collections'
import type { RoomDetail, RoomCollection } from '@/types/room'
import type { Collection } from '@/types/collection'

function CollectionTile({
  collection,
  href,
  action,
}: {
  collection: RoomCollection | Collection
  href?: string
  action: React.ReactNode
}) {
  const body = (
    <div className="flex items-center gap-2 min-w-0">
      <Layers size={16} style={{ color: 'var(--palace)' }} />
      <div className="min-w-0">
        <span className="font-medium text-sm truncate block">{collection.name}</span>
        <span className="text-xs text-muted-foreground">{collection.deck_count} デッキ</span>
      </div>
    </div>
  )
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
      {href ? (
        <Link href={href} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
          {body}
        </Link>
      ) : (
        body
      )}
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export default function RoomDetailPage() {
  const { id: spaceId, roomId } = useParams<{ id: string; roomId: string }>()
  const router = useRouter()

  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [picking, setPicking] = useState(false)
  const [allCollections, setAllCollections] = useState<Collection[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getRoom(spaceId, roomId)
      .then((data) => {
        if (!cancelled) setRoom(data)
      })
      .catch(() => {
        if (!cancelled) setError('ルームの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [spaceId, roomId])

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

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !room) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateRoom(spaceId, roomId, { name: trimmed })
      setRoom({ ...room, name: updated.name })
      setEditing(false)
    } catch {
      setError('ルーム名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteRoom(spaceId, roomId)
      router.push(`/spaces/${spaceId}`)
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleAdd = async (collection: Collection) => {
    if (!room) return
    setBusyId(collection.id)
    try {
      await addCollectionToRoom(spaceId, roomId, collection.id)
      setRoom({
        ...room,
        collections: [
          { id: collection.id, name: collection.name, description: collection.description, deck_count: collection.deck_count },
          ...room.collections,
        ],
        collection_count: room.collection_count + 1,
      })
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (collection: RoomCollection) => {
    if (!room) return
    setBusyId(collection.id)
    try {
      await removeCollectionFromRoom(spaceId, roomId, collection.id)
      setRoom({
        ...room,
        collections: room.collections.filter((c) => c.id !== collection.id),
        collection_count: Math.max(room.collection_count - 1, 0),
      })
    } catch {
      setError('除外に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  if (error && !room) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href={`/spaces/${spaceId}`}><Button variant="outline">← スペースへ戻る</Button></Link>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-20 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  const placedIds = new Set(room.collections.map((c) => c.id))
  const pickable = allCollections.filter((c) => !placedIds.has(c.id))

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href={`/spaces/${spaceId}`}>
        <Button variant="ghost" className="text-sm px-0 mb-4">← スペースへ戻る</Button>
      </Link>

      <div className="flex items-center justify-between gap-3 mb-8">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveName() } if (e.key === 'Escape') setEditing(false) }}
              disabled={saving}
              autoFocus
              aria-label="ルーム名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{room.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{room.collection_count} コレクション</span>
            <button
              onClick={() => { setNameDraft(room.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="ルーム名を編集"
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

      {/* コレクション配置 */}
      <section className="space-y-3 mb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">コレクション</h2>
          {!picking && (
            <Button variant="outline" size="sm" onClick={openPicker} className="flex items-center gap-1.5">
              <Plus size={14} />
              コレクションを配置
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
                  <CollectionTile
                    key={collection.id}
                    collection={collection}
                    action={
                      <Button
                        size="icon-sm"
                        onClick={() => handleAdd(collection)}
                        disabled={busyId === collection.id}
                        aria-label="このコレクションを配置"
                        className="rounded-full"
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

        {room.collections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            まだコレクションが配置されていません。
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {room.collections.map((collection) => (
              <CollectionTile
                key={collection.id}
                collection={collection}
                href={`/collections/${collection.id}`}
                action={
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => handleRemove(collection)}
                    disabled={busyId === collection.id}
                    aria-label="このコレクションを外す"
                    className="rounded-full"
                  >
                    <X size={14} />
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ビュー配置: #112 / #113 で実装予定 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">ビュー</h2>
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground/70">近日対応予定</p>
          <p className="mt-1">ルームにフリーボード（ビュー）を配置できるようになります。</p>
        </div>
      </section>
    </div>
  )
}
