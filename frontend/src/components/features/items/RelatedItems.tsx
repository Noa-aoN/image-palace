'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { BlockAction, BlockEmpty, BlockError, PropertyBlock } from '@/components/features/items/PropertyBlock'
import {
  getItemRelations,
  addItemRelation,
  removeItemRelation,
  getItemSuggestions,
  type ItemSuggestion,
} from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * 関連カード。
 *
 * つながりに向きは持たせていない。A に B を足したら B にも A が出る。
 * 向きを意識させると、同じつながりを2本作る人が出て、消すときに
 * どちらを消せばよいのか分からなくなる。
 *
 * 絵で覚えるサービスなので、リンクではなく**ミニカード**で並べる。
 * 名前だけの一覧だと、せっかく作った絵が思い出しの手がかりにならない。
 */
export function RelatedItems({ item }: { item: Item }) {
  const [relations, setRelations] = useState<Item[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getItemRelations(item.id)
      .then((rows) => {
        if (!cancelled) setRelations(rows)
      })
      .catch(() => {
        if (!cancelled) setError('関連カードを読み込めませんでした。')
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  const remove = async (id: string) => {
    setError(null)
    try {
      setRelations(await removeItemRelation(item.id, id))
    } catch {
      setError('外せませんでした。もう一度お試しください。')
    }
  }

  return (
    <PropertyBlock
      title="関連カード"
      actions={
        !adding && <BlockAction icon={<Plus size={14} />} label="関連カードを足す" onClick={() => setAdding(true)} />
      }
    >
      {adding && (
        <RelationPicker
          item={item}
          existingIds={(relations ?? []).map((r) => r.id)}
          onAdded={(rows) => {
            setRelations(rows)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {relations === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 読み込み中…
        </p>
      ) : relations.length === 0 ? (
        !adding && <BlockEmpty>まだありません（＋から既にあるカードを足せます）</BlockEmpty>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {relations.map((related) => (
            <li key={related.id} className="group relative">
              <Link
                href={`/items/${related.id}`}
                className="block overflow-hidden rounded-lg border border-border bg-card transition hover:border-[var(--palace)]"
              >
                <div className="aspect-square w-full bg-muted">
                  {related.media?.thumb_url || related.media?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={related.media.thumb_url ?? related.media.url}
                      alt={related.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </div>
                <p className="truncate px-1.5 py-1 text-xs">{related.title}</p>
              </Link>
              <button
                type="button"
                onClick={() => remove(related.id)}
                aria-label={`${related.title} との関連を外す`}
                className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BlockError message={error} />
    </PropertyBlock>
  )
}

/**
 * 足すカードを選ぶ。
 *
 * 一覧から選ばせるのではなく検索にしているのは、カードが数百枚になると
 * 一覧から探すほうが遅くなるため。既に繋がっている相手と自分自身は候補から外す。
 */
function RelationPicker({
  item,
  existingIds,
  onAdded,
  onCancel,
}: {
  item: Item
  existingIds: string[]
  onAdded: (relations: Item[]) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = query.trim()

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!q) return
    // 1文字打つたびに問い合わせない
    timer.current = setTimeout(() => {
      getItemSuggestions(q)
        .then(setSuggestions)
        .catch(() => {})
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q])

  // 絞り込みは描くときに行う。effect の中で状態を消すと、入力のたびに
  // 余計な再描画が連鎖する。自分自身と、既に繋がっている相手は候補から外す
  const candidates = q ? suggestions.filter((r) => r.id !== item.id && !existingIds.includes(r.id)) : []

  const add = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      onAdded(await addItemRelation(item.id, id))
    } catch {
      setError('足せませんでした。もう一度お試しください。')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カードの名前で探す"
          aria-label="関連づけるカードを探す"
          autoFocus
          disabled={busy}
        />
        <button
          type="button"
          onClick={onCancel}
          aria-label="やめる"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 追加中…
        </p>
      ) : candidates.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {candidates.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => add(s.id)}
                className="w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted"
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      ) : q ? (
        <p className="text-sm text-muted-foreground">見つかりませんでした。</p>
      ) : null}

      <BlockError message={error} />
    </div>
  )
}
