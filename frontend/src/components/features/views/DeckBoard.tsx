'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, X, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItems } from '@/lib/api/items'
import { addDeckCard, removeViewItem, reorderDeckCards } from '@/lib/api/views'
import type { ViewItemPlacement } from '@/types/view'
import type { Item } from '@/types/item'

// deck 種別のビュー本体：カードの順序付きリスト（追加・削除・並び替え）。
export function DeckBoard({ viewId, initialItems }: { viewId: string; initialItems: ViewItemPlacement[] }) {
  const [items, setItems] = useState<ViewItemPlacement[]>(initialItems)
  const [picking, setPicking] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const placedIds = new Set(items.map((i) => i.item_id))

  const openPicker = async () => {
    setPicking(true)
    if (allItems.length === 0) {
      try {
        setAllItems(await getItems())
      } catch {
        // 取得失敗時はピッカーが空になるだけ
      }
    }
  }

  const addCard = async (item: Item) => {
    setBusy(true)
    try {
      await addDeckCard(viewId, item.id)
      setItems((cur) => [
        ...cur,
        {
          item_id: item.id,
          x: 0,
          y: 0,
          z_index: 0,
          item: { id: item.id, title: item.title, generation_status: item.generation_status, media: item.media ?? null },
        },
      ])
    } catch {
      // noop
    } finally {
      setBusy(false)
    }
  }

  const removeCard = async (itemId: string) => {
    setBusy(true)
    try {
      await removeViewItem(viewId, itemId)
      setItems((cur) => cur.filter((i) => i.item_id !== itemId))
    } catch {
      // noop
    } finally {
      setBusy(false)
    }
  }

  const persistOrder = async (ordered: ViewItemPlacement[]) => {
    try {
      await reorderDeckCards(viewId, ordered.map((i) => i.item_id))
    } catch {
      // noop（楽観更新のまま）
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    await persistOrder(next)
  }

  // ドラッグ中は target の位置へ即時に差し込む（楽観更新）。確定は dragEnd で永続化。
  const handleDragOver = (index: number) => {
    if (dragIndex === null || dragIndex === index) return
    const next = [...items]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setItems(next)
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    if (dragIndex !== null) persistOrder(items)
    setDragIndex(null)
  }

  return (
    <div className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} 枚</p>
        <Button size="sm" onClick={openPicker} className="flex items-center gap-1">
          <Plus size={14} />
          カードを追加
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
          まだカードがありません。「カードを追加」から入れましょう。
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((vi, index) => {
            const url = vi.item.media?.thumb_url ?? vi.item.media?.url ?? null
            return (
              <li
                key={vi.item_id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); handleDragOver(index) }}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-xl border border-border bg-card p-2 ${
                  dragIndex === index ? 'opacity-50' : ''
                }`}
              >
                <span className="cursor-grab text-muted-foreground/60 active:cursor-grabbing" aria-hidden="true">
                  <GripVertical size={16} />
                </span>
                <span className="w-6 text-center text-xs text-muted-foreground">{index + 1}</span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={vi.item.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <Link href={`/items/${vi.item_id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {vi.item.title}
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => move(index, -1)} disabled={index === 0 || busy} aria-label="上へ" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUp size={16} />
                  </button>
                  <button onClick={() => move(index, 1)} disabled={index === items.length - 1 || busy} aria-label="下へ" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDown size={16} />
                  </button>
                  <button onClick={() => removeCard(vi.item_id)} disabled={busy} aria-label="外す" className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                    <X size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPicking(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">カードを追加</h3>
              <button onClick={() => setPicking(false)} aria-label="閉じる">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allItems
                .filter((it) => !placedIds.has(it.id))
                .map((it) => {
                  const url = it.media?.thumb_url ?? it.media?.url ?? null
                  return (
                    <button key={it.id} onClick={() => addCard(it)} disabled={busy} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left hover:shadow-md">
                      <span className="truncate px-2 py-1 text-xs font-medium">{it.title}</span>
                      <div className="aspect-square overflow-hidden bg-muted">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={it.title} className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
