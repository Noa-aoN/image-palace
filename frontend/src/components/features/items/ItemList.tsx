'use client'

import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, X, Trash2, CheckSquare, Square, Tags, Tag as TagIcon, ShieldCheck, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  getItemsPage,
  getItemSuggestions,
  bulkDeleteItems,
  generateTags,
  generateMeaning,
  factCheckItem,
  isItemSkip,
  type ItemSuggestion,
  type ItemOrSkip,
} from '@/lib/api/items'
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

// 一括AI操作の per-item 結果（完了後の確認ダイアログ用）
type BulkResultEntry = {
  id: string
  title: string
  outcome: 'processed' | 'skipped' | 'failed'
  item?: Item
  reason?: string
}

const SKIP_REASON_LABEL: Record<string, string> = {
  no_meaning: '説明が無いためスキップ',
  already_has_meaning: '既に説明があるためスキップ',
  already_tagged: '既にタグがあるためスキップ',
}

const FACT_CHECK_LABEL: Record<string, string> = {
  correct: '✓ 正しい',
  doubtful: '⚠ 疑わしい',
  incorrect: '✗ 誤り',
}

// 結果バッジ（ラベル＋色）。ファクトチェックは判定（正しい/疑わしい/誤り）で色分けする。
function bulkBadge(label: string, e: BulkResultEntry): { text: string; className: string } {
  const base = 'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium '
  if (e.outcome === 'failed') return { text: '失敗', className: base + 'bg-red-100 text-red-700' }
  if (e.outcome === 'skipped') return { text: 'スキップ', className: base + 'bg-muted text-muted-foreground' }
  const status = label.includes('ファクトチェック') ? e.item?.fact_check_status : undefined
  if (status) {
    const cls =
      status === 'correct' ? 'bg-green-100 text-green-700'
      : status === 'doubtful' ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-700'
    return { text: FACT_CHECK_LABEL[status] ?? '完了', className: base + cls }
  }
  return { text: '完了', className: base + 'bg-green-100 text-green-700' }
}

// 注意が必要な行（失敗・ファクトチェックで正しい以外）は左罫線＋淡い背景で強調する。
function bulkRowClass(label: string, e: BulkResultEntry): string {
  if (e.outcome === 'failed') return 'border-l-2 border-l-red-400 bg-red-50/40'
  if (label.includes('ファクトチェック')) {
    const s = e.item?.fact_check_status
    if (s === 'incorrect') return 'border-l-2 border-l-red-400 bg-red-50/40'
    if (s === 'doubtful') return 'border-l-2 border-l-yellow-400 bg-yellow-50/50'
  }
  return ''
}

// アクション種別（label）に応じて結果の要点テキストを返す。確認ダイアログ/リストの説明用。
function bulkResultDetail(label: string, e: BulkResultEntry): string | null {
  if (e.outcome === 'failed') return '生成に失敗しました（再試行できます）'
  if (e.outcome === 'skipped') return e.reason ? (SKIP_REASON_LABEL[e.reason] ?? 'スキップしました') : null
  const item = e.item
  if (!item) return null
  if (label.includes('ファクトチェック')) {
    const verdict = item.fact_check_status ? FACT_CHECK_LABEL[item.fact_check_status] : null
    if (!verdict) return null
    return item.fact_check_comment ? `${verdict} — ${item.fact_check_comment}` : verdict
  }
  if (label.includes('説明')) return item.meaning ?? null
  if (label.includes('タグ')) {
    const names = item.tags?.map((t) => t.name) ?? []
    return names.length ? `タグ: ${names.join(' / ')}` : 'タグなし'
  }
  return null
}

const POLLING_STATUSES = new Set(['pending', 'processing'])

type ItemCardProps = {
  item: Item
  selectionMode: boolean
  selected: boolean
  onToggle: (id: string) => void
}

function ItemCard({ item, selectionMode, selected, onToggle }: ItemCardProps) {
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

  const inner = (
    <>
      {/* テキストを上・画像を下に配置 */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{item.title}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}
        >
          {STATUS_LABEL[item.generation_status] ?? item.generation_status}
        </span>
      </div>
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
    </>
  )

  // 選択モード中はナビゲーションせず、クリックで選択をトグルする
  if (selectionMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-pressed={selected}
        className={`relative flex flex-col rounded-xl border overflow-hidden bg-card text-left transition-shadow ${
          selected ? 'border-[var(--palace)] ring-2 ring-[var(--palace)]' : 'border-border hover:shadow-md'
        }`}
      >
        <span
          className={`absolute left-2 top-2 z-10 rounded-md ${selected ? 'text-[var(--palace)]' : 'text-white'}`}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
        >
          {selected ? <CheckSquare size={22} /> : <Square size={22} />}
        </span>
        {inner}
      </button>
    )
  }

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
      prefetch
      onMouseEnter={warmupDetail}
      onFocus={warmupDetail}
    >
      {inner}
    </Link>
  )
}

export function ItemList({ initialTag = null }: { initialTag?: string | null }) {
  const router = useRouter()
  const items = useItemsStore((state) => state.items)
  const setItems = useItemsStore((state) => state.setItems)
  const removeItemFromStore = useItemsStore((state) => state.removeItem)
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

  // 選択モード・一括削除
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  // 一括AI操作（タグ再設定・付与・ファクトチェック・説明付与）の進捗とサマリ
  const [bulkAction, setBulkAction] = useState<{ label: string; done: number; total: number } | null>(null)
  const [bulkSummary, setBulkSummary] = useState<string | null>(null)
  // 完了後に確認できる per-item 結果
  const [bulkResults, setBulkResults] = useState<{ label: string; entries: BulkResultEntry[] } | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [confirmTagReplace, setConfirmTagReplace] = useState(false)
  const cancelBulkRef = useRef(false)
  const upsertItem = useItemsStore((state) => state.upsertItem)
  const bulkBusy = deleting || bulkAction !== null

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setConfirmTagReplace(false)
    setActionError(null)
    setBulkSummary(null)
    setBulkResults(null)
    setResultsOpen(false)
  }

  // 選択カードを1件ずつ AI 操作に通す共通ループ。進捗を出し、スキップ/失敗を集計する。
  const runBulkAi = async (label: string, fn: (id: string) => Promise<ItemOrSkip>) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    cancelBulkRef.current = false
    setActionError(null)
    setBulkSummary(null)
    setBulkResults(null)
    setResultsOpen(false)
    setBulkAction({ label, done: 0, total: ids.length })

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const titleOf = (id: string) => items.find((it) => it.id === id)?.title ?? id
    const entries: BulkResultEntry[] = []
    let processed = 0
    let skipped = 0
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      if (cancelBulkRef.current) break
      let attempt = 0
      // レート制限（429）は待って再試行し、取りこぼさない
      for (;;) {
        try {
          const result = await fn(ids[i])
          if (isItemSkip(result)) {
            skipped += 1
            entries.push({ id: ids[i], title: titleOf(ids[i]), outcome: 'skipped', reason: result.reason })
          } else {
            upsertItem(result)
            processed += 1
            entries.push({ id: ids[i], title: result.title, outcome: 'processed', item: result })
          }
          break
        } catch (err) {
          const res = (err as { response?: { status?: number; headers?: Record<string, string> } }).response
          if (res?.status === 429 && attempt < 30 && !cancelBulkRef.current) {
            attempt += 1
            const retryAfter = Number(res.headers?.['retry-after']) || 5
            setBulkAction({ label: `${label}（混雑のため待機中）`, done: i, total: ids.length })
            await sleep(Math.min(retryAfter, 60) * 1000)
            if (cancelBulkRef.current) break
            continue
          }
          failed += 1
          entries.push({ id: ids[i], title: titleOf(ids[i]), outcome: 'failed' })
          break
        }
      }
      setBulkAction({ label, done: i + 1, total: ids.length })
    }

    setBulkAction(null)
    setConfirmTagReplace(false)
    const parts = [`${processed}件処理`]
    if (skipped) parts.push(`${skipped}件スキップ`)
    if (failed) parts.push(`${failed}件失敗`)
    if (cancelBulkRef.current) parts.push('中断')
    setBulkSummary(`${label}: ${parts.join(' / ')}`)
    if (entries.length > 0) setBulkResults({ label, entries })
  }

  // ① タグを再設定（AI結果で置き換え・破壊的なので2段階確認）
  const handleTagReplace = () => {
    if (selectedIds.size === 0) return
    if (!confirmTagReplace) { setConfirmTagReplace(true); return }
    runBulkAi('タグを再設定', (id) => generateTags(id, { replace: true }))
  }
  // ③ タグを付与（未設定のみ）
  const handleTagFill = () => runBulkAi('タグを付与', (id) => generateTags(id, { onlyIfEmpty: true }))
  // ② 説明をファクトチェック（説明なしはスキップ）
  const handleFactCheck = () => runBulkAi('ファクトチェック', (id) => factCheckItem(id))
  // ④ 説明を付与（未設定のみ）
  const handleMeaningFill = () => runBulkAi('説明を付与', (id) => generateMeaning(id, undefined, { onlyIfEmpty: true }))

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return }

    const ids = [...selectedIds]
    setDeleting(true)
    setActionError(null)
    try {
      const deleted = await bulkDeleteItems(ids)
      deleted.forEach(removeItemFromStore)
      exitSelection()
      setRefreshToken((t) => t + 1)
    } catch {
      setActionError('カードの削除に失敗しました。もう一度お試しください。')
      setConfirmBulkDelete(false)
    } finally {
      setDeleting(false)
    }
  }

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
  }, [page, activeTag, appliedQuery, sortKey, statusFilter, refreshToken])

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

  const selectionBar = !selectionMode ? (
    <div className="flex justify-end">
      <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
        選択
      </Button>
    </div>
  ) : (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <button
          type="button"
          onClick={toggleSelectAll}
          disabled={bulkBusy}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          {allSelected ? 'すべて解除' : 'すべて選択'}
        </button>
        <span className="text-sm text-muted-foreground">{selectedIds.size}件を選択中</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant={confirmTagReplace ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleTagReplace}
            disabled={bulkBusy || selectedIds.size === 0}
            onBlur={() => setConfirmTagReplace(false)}
            className="flex items-center gap-1.5"
            title="選択カードのタグをAIの結果で置き換えます"
          >
            <Tags size={14} />
            {confirmTagReplace ? `置き換える（${selectedIds.size}件）` : 'タグを再設定'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleTagFill} disabled={bulkBusy || selectedIds.size === 0}
            className="flex items-center gap-1.5" title="タグが無いカードにだけAIでタグを付けます">
            <TagIcon size={14} />タグを付与
          </Button>
          <Button variant="outline" size="sm" onClick={handleFactCheck} disabled={bulkBusy || selectedIds.size === 0}
            className="flex items-center gap-1.5" title="説明が事実として正しいかAIでチェックします">
            <ShieldCheck size={14} />ファクトチェック
          </Button>
          <Button variant="outline" size="sm" onClick={handleMeaningFill} disabled={bulkBusy || selectedIds.size === 0}
            className="flex items-center gap-1.5" title="説明が無いカードにだけAIで説明を付けます">
            <FileText size={14} />説明を付与
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button
            variant={confirmBulkDelete ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkBusy || selectedIds.size === 0}
            onBlur={() => setConfirmBulkDelete(false)}
            className="flex items-center gap-1.5"
          >
            {deleting ? <Spinner size={14} /> : <Trash2 size={14} />}
            {deleting ? '削除中...' : confirmBulkDelete ? `本当に削除（${selectedIds.size}件）` : '削除'}
          </Button>
          <Button variant="ghost" size="sm" onClick={exitSelection} disabled={bulkBusy}>
            キャンセル
          </Button>
        </div>
      </div>
      {bulkAction && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} />
          {bulkAction.label}中... ({bulkAction.done}/{bulkAction.total})
          <button
            type="button"
            onClick={() => { cancelBulkRef.current = true }}
            className="underline hover:text-foreground"
          >
            中断
          </button>
        </div>
      )}
      {bulkSummary && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{bulkSummary}</span>
            {bulkResults && bulkResults.entries.length > 0 && (
              <button
                type="button"
                onClick={() => setResultsOpen((v) => !v)}
                className="underline hover:text-foreground"
              >
                {resultsOpen ? '結果を閉じる' : '結果を確認'}
              </button>
            )}
          </div>
          {resultsOpen && bulkResults && (
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border border-border bg-card">
              {bulkResults.entries.map((e) => {
                const detail = bulkResultDetail(bulkResults.label, e)
                const badge = bulkBadge(bulkResults.label, e)
                return (
                  <li key={e.id} className={`px-3 py-2 ${bulkRowClass(bulkResults.label, e)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/items/${e.id}`} className="text-sm font-medium hover:underline">
                        {e.title}
                      </Link>
                      <span className={badge.className}>{badge.text}</span>
                    </div>
                    {detail && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{detail}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      {filterBar}
      {selectionBar}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onToggle={toggleSelect}
          />
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
