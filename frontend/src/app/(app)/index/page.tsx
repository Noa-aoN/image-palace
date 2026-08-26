'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pagination } from '@/components/ui/pagination'
import Link from 'next/link'
import { List, Search, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getItemsPage, bulkDeleteItems } from '@/lib/api/items'
import type { Item, GenerationStatus } from '@/types/item'

const PER = 50

const STATUS_LABEL: Record<GenerationStatus, string> = {
  pending: '生成待ち',
  processing: '生成中',
  completed: '完了',
  failed: '失敗',
}

// インデックス: 画像を表示しないテキスト一覧。検索・選択して、画像を見ずにまとめて削除するためのページ。
export default function IndexPage() {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 検索のデバウンス（入力が落ち着いてから適用し、1ページ目に戻す）。
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getItemsPage(page, PER, {
        query: appliedQuery,
        sort: 'created_at',
        direction: 'desc',
      })
      setItems(res.items)
      setTotalPages(res.meta.total_pages)
      setTotalCount(res.meta.total_count)
    } catch {
      setError('カードの読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [page, appliedQuery])

  useEffect(() => {
    load()
  }, [load])

  // 選択が変わったら削除確認をリセット（誤操作防止）。
  useEffect(() => {
    setConfirmDelete(false)
  }, [selectedIds])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) items.forEach((i) => next.delete(i.id))
      else items.forEach((i) => next.add(i.id))
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    // 2段確認: 1回目はラベルを「本当に削除」に変え、2回目で実行する。
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const ids = [...selectedIds]
      const deleted = await bulkDeleteItems(ids)
      setSelectedIds(new Set())
      setConfirmDelete(false)
      setTotalCount((c) => Math.max(0, c - deleted.length))
      // 削除で歯抜けになるため再読込してページを詰める。
      await load()
    } catch {
      setError('削除に失敗しました。')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <List size={26} style={{ color: 'var(--palace)' }} />
        インデックス
      </h1>
      <p className="mt-2 text-muted-foreground">
        画像を表示しないカードの一覧です。検索・選択して、カードにジャンプしたり、画像を見ずにまとめて削除できます（全 {totalCount} 件）。
      </p>

      {/* 検索 */}
      <div className="relative mt-6">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カードを検索"
          className="pl-9"
          aria-label="カードを検索"
        />
      </div>

      {/* 一括操作バー */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={items.length === 0}
            className="h-4 w-4"
          />
          このページを全選択
        </label>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={deleting}
            className="flex items-center gap-1.5"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {confirmDelete ? `本当に削除（${selectedIds.size}件）` : `削除（${selectedIds.size}件）`}
          </Button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* 一覧（画像は表示しない） */}
      {loading ? (
        <ul className="mt-4 divide-y overflow-hidden rounded-xl border">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="h-11 animate-pulse bg-muted/50" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {appliedQuery ? '該当するカードがありません。' : 'カードがありません。'}
        </p>
      ) : (
        <ul className="mt-4 divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-black/[0.02]">
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                className="h-4 w-4 shrink-0"
                aria-label={`${item.title} を選択`}
              />
              <Link
                href={`/items/${item.id}`}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                {item.title}
              </Link>
              {item.item_type?.label && (
                <span className="shrink-0 text-xs text-muted-foreground">{item.item_type.label}</span>
              )}
              {item.generation_status !== 'completed' && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {STATUS_LABEL[item.generation_status]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        disabled={loading}
        className="mt-6"
      />
    </div>
  )
}
