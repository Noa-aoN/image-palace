'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getItemsPage } from '@/lib/api/items'
import { getSpacesPage } from '@/lib/api/spaces'
import { getViewsPage } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import type { BoxEntryType } from '@/types/box'

// 一度に読む件数。全部読むと、持ちものが増えるほど開くのが遅くなる
const PAGE_SIZE = 20

export interface Pickable {
  id: string
  label: string
  image: string | null
  sub?: string
}

interface Page {
  items: Pickable[]
  /** 続きの位置。null なら最後まで読んだ */
  next: string | null
}

/**
 * ボックスへ入れるものを選ぶ一覧。
 *
 * 以前は開いた瞬間に全件読んでいた。持ちものが増えるほど開くのが遅くなるので、
 * 少しずつ読み、探すときは絞り込みをサーバー側でかける。
 *
 * すでに入っているものは出さない（押しても何も起きないものを並べない）。
 */
export function EntryPicker({
  type,
  excludeIds,
  onPick,
  busyId,
}: {
  type: BoxEntryType
  /** すでにボックスに入っているものの id */
  excludeIds: Set<string>
  onPick: (id: string) => void
  busyId: string | null
}) {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [rows, setRows] = useState<Pickable[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(
    async (q: string, cursor: string | null): Promise<Page> => {
      if (type === 'Item') {
        // カードはページ番号で引く（既存の一覧と同じ仕組み）
        const page = Number(cursor ?? 1)
        const result = await getItemsPage(page, PAGE_SIZE, { query: q })
        return {
          items: result.items.map((i) => ({
            id: i.id,
            label: i.title,
            image: i.media?.thumb_url ?? i.media?.url ?? null,
          })),
          next: page < result.meta.total_pages ? String(page + 1) : null,
        }
      }

      if (type === 'Space') {
        const result = await getSpacesPage({ q, limit: PAGE_SIZE, cursor })
        return {
          items: result.spaces.map((s) => ({ id: s.id, label: s.name, image: null })),
          next: result.next_cursor,
        }
      }

      const result = await getViewsPage({ q, limit: PAGE_SIZE, cursor })
      return {
        items: result.views.map((v) => ({
          id: v.id,
          label: v.name,
          image: null,
          sub: viewTypeLabel(v.view_type),
        })),
        next: result.next_cursor,
      }
    },
    [type]
  )

  const load = useCallback(
    async (q: string, cursor: string | null) => {
      setLoading(true)
      try {
        const page = await fetchPage(q, cursor)
        setRows((prev) => (cursor ? [...prev, ...page.items] : page.items))
        setNext(page.next)
      } catch {
        if (!cursor) setRows([])
        setNext(null)
      } finally {
        setLoading(false)
      }
    },
    [fetchPage]
  )

  useEffect(() => {
    load(submitted, null)
  }, [load, submitted])

  // すでに入っているものは出さない
  const visible = rows.filter((row) => !excludeIds.has(row.id))

  return (
    <div className="mt-4 space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(query.trim())
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // 変換確定の Enter で検索してしまわないようにする
            if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault()
          }}
          placeholder="名前で絞り込む"
          aria-label="追加するものを絞り込む"
        />
        <Button type="submit" variant="outline" size="sm" className="flex shrink-0 items-center gap-1.5">
          <Search size={15} />
          検索
        </Button>
      </form>

      {visible.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">
          {submitted ? '該当するものがありません。' : '追加できるものがありません。'}
        </p>
      ) : (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {visible.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-9 w-9 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.label}</span>
                  {row.sub && <span className="text-xs text-muted-foreground">{row.sub}</span>}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => onPick(row.id)}
                disabled={busyId === row.id}
                className="shrink-0"
              >
                <Plus size={14} />
                追加
              </Button>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">読み込み中…</p>}

      {next && !loading && (
        <Button variant="outline" size="sm" onClick={() => load(submitted, next)}>
          さらに読み込む
        </Button>
      )}
    </div>
  )
}
