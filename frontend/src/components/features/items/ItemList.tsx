'use client'

import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItemsPage, getItemSuggestions, type ItemSuggestion } from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import { useItemsStore } from '@/stores/items'
import type { Item } from '@/types/item'
import type { Tag } from '@/types/tag'

const PER_PAGE = 24

const STATUS_LABEL: Record<string, string> = {
  pending: '生成待ち',
  processing: '生成中',
  completed: '完了',
  failed: '失敗',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const POLLING_STATUSES = new Set(['pending', 'processing'])

function ItemCard({ item }: { item: Item }) {
  const router = useRouter()
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const isGenerating = POLLING_STATUSES.has(item.generation_status)
  const warmedRef = useRef(false)
  const imageUrl = item.media?.thumb_url ?? item.media?.url
  const resolvedImageUrl = imageUrl ?? null
  const hasImageError = resolvedImageUrl !== null && failedImageUrl === resolvedImageUrl

  const warmupDetail = () => {
    if (warmedRef.current) return
    warmedRef.current = true

    startTransition(() => {
      useItemsStore.getState().upsertItem(item)
      router.prefetch(`/items/${item.id}`)
    })
  }

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
      prefetch
      onMouseEnter={warmupDetail}
      onFocus={warmupDetail}
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {resolvedImageUrl && !hasImageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            onError={() => setFailedImageUrl(resolvedImageUrl)}
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-muted">
            {isGenerating && (
              <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_40%,rgba(255,255,255,0.14))]" />
            )}
            <span className="relative z-10 text-muted-foreground text-xs px-2 text-center">
              {hasImageError ? '期限切れ' : (STATUS_LABEL[item.generation_status] ?? item.generation_status)}
            </span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{item.title}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}
        >
          {STATUS_LABEL[item.generation_status] ?? item.generation_status}
        </span>
      </div>
    </Link>
  )
}

export function ItemList({ initialTag = null }: { initialTag?: string | null }) {
  const router = useRouter()
  const items = useItemsStore((state) => state.items)
  const setItems = useItemsStore((state) => state.setItems)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(() => useItemsStore.getState().items.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(initialTag)
  const [sortKey, setSortKey] = useState('created_at:desc')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([])
  const [suggestFocused, setSuggestFocused] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(true)
  const [activeIndex, setActiveIndex] = useState(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestInFlightRef = useRef(false)

  // 入力をデバウンスして検索に反映（変更時は1ページ目に戻す）
  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  // オートコンプリート候補（軽量サジェスト・短めのデバウンス）
  useEffect(() => {
    const q = query.trim()
    const handle = setTimeout(() => {
      if (!q) { setSuggestions([]); return }
      getItemSuggestions(q).then(setSuggestions).catch(() => setSuggestions([]))
    }, 180)
    return () => clearTimeout(handle)
  }, [query])

  const showSuggestions = suggestFocused && suggestOpen && suggestions.length > 0

  const goToSuggestion = (s: ItemSuggestion) => {
    setSuggestOpen(false)
    router.push(`/items/${s.id}`)
  }

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        goToSuggestion(suggestions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false)
    }
  }

  // タグ一覧（絞り込みチップ用）
  useEffect(() => {
    let cancelled = false
    getTags()
      .then((data) => {
        if (!cancelled) setTags(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // 現在ページを取得し、ストア（＝詳細画面の前後ナビが参照）へ反映する
  const fetchPage = useEffectEvent(async (targetPage: number): Promise<Item[] | null> => {
    if (requestInFlightRef.current) return null

    requestInFlightRef.current = true
    try {
      const [sort, direction] = sortKey.split(':')
      const { items: fetched, meta } = await getItemsPage(targetPage, PER_PAGE, {
        tagId: activeTag ?? undefined,
        query: appliedQuery || undefined,
        sort,
        direction,
        status: statusFilter || undefined,
      })
      setItems(fetched)
      setTotalPages(Math.max(meta.total_pages, 1))
      setError(null)
      return fetched
    } catch {
      setError('カードの取得に失敗しました')
      return null
    } finally {
      requestInFlightRef.current = false
    }
  })

  const selectTag = (tagId: string | null) => {
    if (tagId === activeTag) return
    setLoading(true)
    setActiveTag(tagId)
    setPage(1)
  }

  const changeSort = (value: string) => {
    if (value === sortKey) return
    setLoading(true)
    setSortKey(value)
    setPage(1)
  }

  const changeStatus = (value: string) => {
    if (value === statusFilter) return
    setLoading(true)
    setStatusFilter(value)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    // ページ切り替え時は前ページの生成中ポーリングを止める
    clearTimer()
    setLoading(true)

    const poll = async () => {
      const fetched = await fetchPage(page)
      if (cancelled) return

      // 表示中ページに生成中カードがある間だけポーリングを継続する
      const latestItems = fetched ?? useItemsStore.getState().items
      const hasPending = latestItems.some((item) => POLLING_STATUSES.has(item.generation_status))
      if (hasPending) {
        timerRef.current = setTimeout(poll, 3000)
      }
    }

    poll().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      clearTimer()
    }
  }, [page, activeTag, appliedQuery, sortKey, statusFilter])

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages || next === page) return
    setPage(next)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const chipBase = 'rounded-full px-3 py-1 text-sm whitespace-nowrap transition-colors border'
  const tagFilter = tags.length > 0 ? (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => selectTag(null)}
        className={activeTag === null ? `${chipBase} border-transparent text-white` : `${chipBase} border-border text-muted-foreground hover:bg-muted`}
        style={activeTag === null ? { backgroundColor: 'var(--palace)' } : undefined}
      >
        すべて
      </button>
      {tags.map((tag) => {
        const active = activeTag === tag.id
        return (
          <button
            key={tag.id}
            onClick={() => selectTag(tag.id)}
            className={active ? `${chipBase} border-transparent text-white` : `${chipBase} border-border text-muted-foreground hover:bg-muted`}
            style={active ? { backgroundColor: 'var(--palace)' } : undefined}
          >
            {tag.name}（{tag.item_count}）
          </button>
        )
      })}
    </div>
  ) : null

  const searchBox = (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); setActiveIndex(-1) }}
        onFocus={() => setSuggestFocused(true)}
        onBlur={() => setSuggestFocused(false)}
        onKeyDown={onSearchKeyDown}
        placeholder="カードを検索（単語名）"
        aria-label="カード検索"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls="card-suggestions"
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full rounded-lg border border-input bg-background pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setSuggestions([]) }}
          aria-label="検索をクリア"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X size={15} />
        </button>
      )}
      {showSuggestions && (
        <ul
          id="card-suggestions"
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); goToSuggestion(s) }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === activeIndex ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Search size={14} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const sortFilterControls = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sortKey}
        onChange={(e) => changeSort(e.target.value)}
        aria-label="並び替え"
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="created_at:desc">新しい順</option>
        <option value="created_at:asc">古い順</option>
        <option value="title:asc">名前順（あ→ん）</option>
        <option value="title:desc">名前順（ん→あ）</option>
      </select>
      <select
        value={statusFilter}
        onChange={(e) => changeStatus(e.target.value)}
        aria-label="ステータスで絞り込み"
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">すべての状態</option>
        <option value="completed">完了</option>
        <option value="processing">生成中</option>
        <option value="pending">生成待ち</option>
        <option value="failed">失敗</option>
      </select>
    </div>
  )

  const filterBar = (
    <div className="space-y-3">
      {searchBox}
      {tagFilter}
      {sortFilterControls}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {filterBar}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="w-full aspect-square bg-muted animate-pulse" />
              <div className="px-3 py-2">
                <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (items.length === 0) {
    if (activeTag || appliedQuery || statusFilter) {
      return (
        <div className="space-y-6">
          {filterBar}
          <p className="text-center text-muted-foreground py-12">
            {appliedQuery
              ? `「${appliedQuery}」に一致するカードはありません。`
              : statusFilter
                ? 'この条件のカードはありません。'
                : 'このタグのカードはありません。'}
          </p>
        </div>
      )
    }
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">まだカードがありません。単語を入れて、最初の記憶カードを作りましょう。</p>
        <div className="mx-auto max-w-md rounded-xl border border-border/70 bg-muted/40 px-4 py-4 text-left">
          <p className="text-sm font-medium">最初に試しやすい例</p>
          <p className="mt-2 text-sm text-muted-foreground">富士山、光合成、API、細胞分裂</p>
          <p className="mt-1 text-xs text-muted-foreground">具体的な単語から始めると、画像生成が安定しやすいです。</p>
        </div>
        <Link href="/items/new">
          <Button>カードを作成する</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {filterBar}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label="ページネーション">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            前へ
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums" aria-current="page">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1"
          >
            次へ
            <ChevronRight size={16} />
          </Button>
        </nav>
      )}
    </div>
  )
}
