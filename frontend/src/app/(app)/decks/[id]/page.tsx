'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getDeck, updateDeck, deleteDeck, addItemToDeck, removeItemFromDeck } from '@/lib/api/decks'
import { getItems } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
import type { DeckDetail } from '@/types/deck'
import type { Item } from '@/types/item'

function CardThumb({
  item,
  href,
  isCover,
  topRight,
  bottomAction,
}: {
  item: Item
  // 指定時は画像をカード詳細へのリンクにする（マイカード同様の詳細遷移）
  href?: string
  isCover?: boolean
  topRight?: React.ReactNode
  bottomAction?: React.ReactNode
}) {
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  const inner = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
  ) : (
    <span className="text-muted-foreground text-xs px-2 text-center">{item.title}</span>
  )

  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
      <div className="relative w-full aspect-square bg-muted overflow-hidden">
        {href ? (
          <Link href={href} className="flex h-full w-full items-center justify-center hover:opacity-95 transition-opacity">
            {inner}
          </Link>
        ) : (
          <div className="flex h-full w-full items-center justify-center">{inner}</div>
        )}
        {isCover && (
          <span
            className="absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: 'var(--palace)' }}
          >
            表紙
          </span>
        )}
        {topRight && <div className="absolute top-1 right-1 z-10">{topRight}</div>}
      </div>
      <div className="px-2 py-1.5 flex items-center justify-between gap-1">
        <span className="text-xs font-medium truncate">{item.title}</span>
        {bottomAction}
      </div>
    </div>
  )
}

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [picking, setPicking] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const setStoreItems = useItemsStore((s) => s.setItems)

  useEffect(() => {
    let cancelled = false
    getDeck(id)
      .then((data) => {
        if (!cancelled) setDeck(data)
      })
      .catch(() => {
        if (!cancelled) setError('デッキの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // マイカード踏襲: カード詳細の左右移動がこのデッキのカード内になるよう、
  // items ストアにデッキのカードを反映する
  useEffect(() => {
    if (deck) setStoreItems(deck.items)
  }, [deck, setStoreItems])

  const openPicker = async () => {
    setPicking(true)
    if (allItems.length === 0) {
      try {
        setAllItems(await getItems())
      } catch {
        // 取得失敗時は空表示
      }
    }
  }

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !deck) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateDeck(id, { name: trimmed })
      setDeck({ ...deck, name: updated.name })
      setEditing(false)
    } catch {
      setError('デッキ名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteDeck(id)
      router.push('/decks')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleAdd = async (item: Item) => {
    if (!deck) return
    setBusyId(item.id)
    try {
      await addItemToDeck(id, item.id)
      setDeck({ ...deck, items: [item, ...deck.items], item_count: deck.item_count + 1 })
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (item: Item) => {
    if (!deck) return
    setBusyId(item.id)
    try {
      await removeItemFromDeck(id, item.id)
      setDeck({
        ...deck,
        items: deck.items.filter((i) => i.id !== item.id),
        item_count: Math.max(deck.item_count - 1, 0),
        cover_item_id: deck.cover_item_id === item.id ? null : deck.cover_item_id,
      })
    } catch {
      setError('除外に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const handleSetCover = async (item: Item) => {
    if (!deck) return
    setBusyId(item.id)
    try {
      const updated = await updateDeck(id, { cover_item_id: item.id })
      setDeck({ ...deck, cover_item_id: updated.cover_item_id })
    } catch {
      setError('表紙の設定に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  if (error && !deck) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/decks"><Button variant="outline">← デッキ一覧へ</Button></Link>
      </div>
    )
  }

  if (!deck) {
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

  const inDeckIds = new Set(deck.items.map((i) => i.id))
  const pickableItems = allItems.filter((i) => !inDeckIds.has(i.id))

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/decks">
        <Button variant="ghost" className="text-sm px-0 mb-4">← デッキ一覧へ</Button>
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
              aria-label="デッキ名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{deck.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{deck.item_count} 枚</span>
            <button
              onClick={() => { setNameDraft(deck.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="デッキ名を編集"
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
                  <CardThumb
                    key={item.id}
                    item={item}
                    topRight={
                      <Button
                        size="icon-sm"
                        onClick={() => handleAdd(item)}
                        disabled={busyId === item.id}
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

      {deck.items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          まだカードがありません。「カードを追加」から追加してください。
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {deck.items.map((item) => {
            const isCover = deck.cover_item_id === item.id
            return (
              <CardThumb
                key={item.id}
                item={item}
                href={`/items/${item.id}?deck=${id}`}
                isCover={isCover}
                topRight={
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => handleRemove(item)}
                    disabled={busyId === item.id}
                    aria-label="このカードを外す"
                    className="rounded-full shadow"
                  >
                    <X size={14} />
                  </Button>
                }
                bottomAction={
                  <button
                    onClick={() => handleSetCover(item)}
                    disabled={busyId === item.id || isCover}
                    aria-label={isCover ? '表紙に設定済み' : '表紙にする'}
                    title={isCover ? '表紙に設定済み' : '表紙にする'}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                  >
                    <Star size={14} fill={isCover ? 'var(--palace)' : 'none'} color={isCover ? 'var(--palace)' : 'currentColor'} />
                  </button>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
