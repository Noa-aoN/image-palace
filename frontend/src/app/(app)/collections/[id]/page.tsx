'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, Library } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCollection, updateCollection, deleteCollection, addDeckToCollection, removeDeckFromCollection } from '@/lib/api/collections'
import { getDecks } from '@/lib/api/decks'
import type { CollectionDetail, CollectionDeck } from '@/types/collection'
import type { Deck } from '@/types/deck'

function DeckTile({
  deck,
  href,
  action,
}: {
  deck: CollectionDeck | Deck
  // 指定時は表紙をデッキ詳細へのリンクにする
  href?: string
  action: React.ReactNode
}) {
  const coverUrl = deck.cover?.thumb_url ?? deck.cover?.url ?? null
  const inner = coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={coverUrl} alt={deck.name} className="w-full h-full object-cover" loading="lazy" />
  ) : (
    <Library size={24} className="text-muted-foreground/50" />
  )
  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
      <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
        {href ? (
          <Link href={href} className="flex h-full w-full items-center justify-center hover:opacity-95 transition-opacity">
            {inner}
          </Link>
        ) : (
          <div className="flex h-full w-full items-center justify-center">{inner}</div>
        )}
        <div className="absolute top-1 right-1 z-10">{action}</div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{deck.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{deck.item_count} 枚</span>
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
  const [allDecks, setAllDecks] = useState<Deck[]>([])
  const [busyDeckId, setBusyDeckId] = useState<string | null>(null)

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
    if (allDecks.length === 0) {
      try {
        setAllDecks(await getDecks())
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

  const handleAdd = async (deck: Deck) => {
    if (!collection) return
    setBusyDeckId(deck.id)
    try {
      await addDeckToCollection(id, deck.id)
      setCollection({
        ...collection,
        decks: [{ id: deck.id, name: deck.name, item_count: deck.item_count, cover: deck.cover }, ...collection.decks],
        deck_count: collection.deck_count + 1,
      })
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyDeckId(null)
    }
  }

  const handleRemove = async (deck: CollectionDeck) => {
    if (!collection) return
    setBusyDeckId(deck.id)
    try {
      await removeDeckFromCollection(id, deck.id)
      setCollection({
        ...collection,
        decks: collection.decks.filter((d) => d.id !== deck.id),
        deck_count: Math.max(collection.deck_count - 1, 0),
      })
    } catch {
      setError('除外に失敗しました')
    } finally {
      setBusyDeckId(null)
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
            <div key={i} className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const inCollectionIds = new Set(collection.decks.map((d) => d.id))
  const pickableDecks = allDecks.filter((d) => !inCollectionIds.has(d.id))

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
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
            <span className="text-sm text-muted-foreground shrink-0">{collection.deck_count} デッキ</span>
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
      <p className="text-sm text-muted-foreground mb-6">デッキを束ねるコレクションです。</p>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="mb-6">
        {!picking ? (
          <Button variant="outline" size="sm" onClick={openPicker} className="flex items-center gap-1.5">
            <Plus size={16} />
            デッキを追加
          </Button>
        ) : (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">追加するデッキを選択</span>
              <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>閉じる</Button>
            </div>
            {pickableDecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">追加できるデッキがありません。</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pickableDecks.map((deck) => (
                  <DeckTile
                    key={deck.id}
                    deck={deck}
                    action={
                      <Button
                        size="icon-sm"
                        onClick={() => handleAdd(deck)}
                        disabled={busyDeckId === deck.id}
                        aria-label="このデッキを追加"
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

      {collection.decks.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          まだデッキがありません。「デッキを追加」から束ねてください。
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {collection.decks.map((deck) => (
            <DeckTile
              key={deck.id}
              deck={deck}
              href={`/decks/${deck.id}`}
              action={
                <Button
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => handleRemove(deck)}
                  disabled={busyDeckId === deck.id}
                  aria-label="このデッキを外す"
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
