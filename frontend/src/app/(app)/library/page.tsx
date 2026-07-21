'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GalleryHorizontal, Box as BoxIcon, Layers, LayoutGrid, Frame, MapPin, ChevronRight, Plus, Search, X, Route, DoorOpen, ListChecks, Boxes, Images, CheckSquare, Square, Trash2, LibraryBig } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getItemsPage, getItemsSummary, bulkDeleteItems } from '@/lib/api/items'
import { getBoxes, deleteBox } from '@/lib/api/boxes'
import { getSpaces, deleteSpace } from '@/lib/api/spaces'
import { getViews, deleteView } from '@/lib/api/views'
import { getWordlists, deleteWordlist } from '@/lib/api/wordlists'
import { searchLibrary } from '@/lib/api/search'
import { EntityCover } from '@/components/features/shared/EntityCover'
import type { Item } from '@/types/item'
import type { Box } from '@/types/box'
import type { Space } from '@/types/space'
import type { View } from '@/types/view'
import type { Wordlist } from '@/types/wordlist'
import { viewTypeLabel } from '@/lib/view-types'
import { spaceTypeLabel } from '@/lib/space-types'
import type { SearchResults, SearchCard, SearchDeck } from '@/types/search'
import { CardImage } from '@/components/ui/card-image'

const PREVIEW_LIMIT = 12

// 選択対象の形式。ID は形式内でしか一意でないため、選択キーは "形式:ID" で持つ。
type SelectableType = 'card' | 'box' | 'space' | 'view' | 'wordlist'
const selKey = (type: SelectableType, id: string) => `${type}:${id}`

// タイル共通シェル。通常はリンク、選択モードでは選択トグル（チェック表示）になる。
function SelectableTile({
  href,
  className,
  selectionMode = false,
  selected = false,
  onToggle,
  children,
}: {
  href: string
  className: string
  selectionMode?: boolean
  selected?: boolean
  onToggle?: () => void
  children: React.ReactNode
}) {
  if (selectionMode) {
    // タイル内部にカバー画像のカルーセル操作ボタンが入りうるため、ラッパは button ではなく
    // div[role=button] にする（button の入れ子は不正）。内部は pointer-events-none にして
    // クリックを選択トグルへ集約する。
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle?.()
          }
        }}
        aria-pressed={selected}
        className={`${className} relative cursor-pointer text-left ${selected ? 'border-[var(--palace)] ring-2 ring-[var(--palace)]' : 'border-border hover:shadow-md'}`}
      >
        <div className="pointer-events-none">{children}</div>
        <span className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-0.5 shadow-sm">
          {selected ? (
            <CheckSquare size={18} className="text-[var(--palace)]" />
          ) : (
            <Square size={18} className="text-muted-foreground" />
          )}
        </span>
      </div>
    )
  }
  return (
    <Link href={href} className={`${className} border-border hover:shadow-md`}>
      {children}
    </Link>
  )
}

// シェルフ共通の枠（href があれば見出し自体が一覧へのリンク＝シェブロン付き＋横スクロールの中身）
function Shelf({
  icon,
  title,
  count,
  href,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  href?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  // 見出し本体（アイコン＋タイトル＋件数）。href があれば末尾にシェブロンを付けてリンク化の手がかりにする。
  const heading = (
    <>
      <span style={{ color: 'var(--palace)' }}>{icon}</span>
      <h2 className="text-base font-semibold">{title}</h2>
      {typeof count === 'number' && <span className="text-sm text-muted-foreground">{count}</span>}
      {href && (
        <ChevronRight
          size={16}
          className="text-muted-foreground transition-colors group-hover:text-[var(--palace)]"
        />
      )}
    </>
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {href ? (
          <Link
            href={href}
            aria-label={`${title}の一覧を見る`}
            className="group flex items-center gap-2 rounded-md transition-colors hover:text-[var(--palace)]"
          >
            {heading}
          </Link>
        ) : (
          <div className="flex items-center gap-2">{heading}</div>
        )}
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

// 傘セクション（キャンバス / スペース）の見出し＋配下のサブ棚をまとめる枠
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--palace)' }}>{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </div>
      <div className="space-y-8 border-l border-border/60 pl-4">{children}</div>
    </section>
  )
}

function CardThumb({
  item,
  selectionMode = false,
  selected = false,
  onToggle,
}: {
  item: Item
  selectionMode?: boolean
  selected?: boolean
  onToggle?: () => void
}) {
  const inner = (
    <>
      <span className="px-2 py-1.5 text-xs font-medium truncate">{item.title}</span>
      <CardImage
        src={item.media?.thumb_url ?? item.media?.url ?? null}
        blur={item.media?.blur}
        alt={item.title}
        className="w-full aspect-square"
        fallback={<span className="text-muted-foreground text-[11px] px-2 text-center">{item.title}</span>}
      />
    </>
  )
  const base = 'shrink-0 w-32 flex flex-col rounded-xl border overflow-hidden bg-card transition-shadow'

  if (selectionMode) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={`${base} relative text-left ${selected ? 'border-[var(--palace)] ring-2 ring-[var(--palace)]' : 'border-border hover:shadow-md'}`}
      >
        {inner}
        <span className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-0.5 shadow-sm">
          {selected ? (
            <CheckSquare size={18} className="text-[var(--palace)]" />
          ) : (
            <Square size={18} className="text-muted-foreground" />
          )}
        </span>
      </button>
    )
  }

  return (
    <Link href={`/items/${item.id}`} className={`${base} border-border hover:shadow-md`}>
      {inner}
    </Link>
  )
}

// カバー画像が無いスペースのフォールバック（ルーム=部屋 / ロード=道）
function SpaceCoverFallback({ spaceType }: { spaceType: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      {spaceType === 'road' ? (
        <Route size={24} className="text-muted-foreground/50" />
      ) : (
        <DoorOpen size={24} className="text-muted-foreground/50" />
      )}
    </div>
  )
}

// 名前付きタイル共通の枠クラス（枠色/hover は SelectableTile 側で付与）
const NAMED_TILE_CLASS = 'shrink-0 w-40 flex flex-col rounded-xl border overflow-hidden bg-card transition-shadow'

type TileSelectionProps = {
  selectionMode?: boolean
  selected?: boolean
  onToggle?: () => void
}

function BoxTile({ box, selectionMode, selected, onToggle }: { box: Box } & TileSelectionProps) {
  return (
    <SelectableTile
      href={`/boxes/${box.id}`}
      className={NAMED_TILE_CLASS}
      selectionMode={selectionMode}
      selected={selected}
      onToggle={onToggle}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{box.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{box.entry_count}</span>
      </div>
      <div className="w-full aspect-square bg-muted overflow-hidden">
        <EntityCover cover={box} />
      </div>
    </SelectableTile>
  )
}

function WordlistTile({ wordlist, selectionMode, selected, onToggle }: { wordlist: Wordlist } & TileSelectionProps) {
  return (
    <SelectableTile
      href={`/wordlists/${wordlist.id}`}
      className={NAMED_TILE_CLASS}
      selectionMode={selectionMode}
      selected={selected}
      onToggle={onToggle}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{wordlist.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{wordlist.word_count}</span>
      </div>
      <div className="w-full aspect-square bg-muted flex items-center justify-center">
        <ListChecks size={28} className="text-muted-foreground/50" />
      </div>
    </SelectableTile>
  )
}

function SpaceTile({ space, selectionMode, selected, onToggle }: { space: Space } & TileSelectionProps) {
  return (
    <SelectableTile
      href={`/spaces/${space.id}`}
      className={NAMED_TILE_CLASS}
      selectionMode={selectionMode}
      selected={selected}
      onToggle={onToggle}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{space.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{spaceTypeLabel(space.space_type)}</span>
      </div>
      <div className="w-full aspect-square bg-muted overflow-hidden">
        <EntityCover cover={space} fallback={<SpaceCoverFallback spaceType={space.space_type} />} />
      </div>
    </SelectableTile>
  )
}

function ViewTile({ view, selectionMode, selected, onToggle }: { view: View } & TileSelectionProps) {
  return (
    <SelectableTile
      href={`/views/${view.id}`}
      className={NAMED_TILE_CLASS}
      selectionMode={selectionMode}
      selected={selected}
      onToggle={onToggle}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{view.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{viewTypeLabel(view.view_type)}</span>
      </div>
      <div className="w-full aspect-square bg-muted overflow-hidden">
        <EntityCover cover={view} />
      </div>
    </SelectableTile>
  )
}

// 横スクロールのレール
function Rail({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 overflow-x-auto pb-2">{children}</div>
}

function EmptyRail({ message, cta }: { message: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
      <span>{message}</span>
      {cta}
    </div>
  )
}

// 横断検索のグループ見出し
function ResultGroup({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--palace)' }}>{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  )
}

function SearchCardTile({ card }: { card: SearchCard }) {
  return (
    <Link
      href={`/items/${card.id}`}
      className="shrink-0 w-32 flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <span className="px-2 py-1.5 text-xs font-medium truncate">{card.title}</span>
      <CardImage
        src={card.media?.thumb_url ?? card.media?.url ?? null}
        blur={card.media?.blur}
        alt={card.title}
        className="w-full aspect-square"
        fallback={<span className="text-muted-foreground text-[11px] px-2 text-center">{card.title}</span>}
      />
    </Link>
  )
}

function SearchDeckTile({ deck }: { deck: SearchDeck }) {
  return (
    <Link
      href={`/views/${deck.id}`}
      className="shrink-0 w-40 flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{deck.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{deck.item_count}</span>
      </div>
      <CardImage
        src={deck.cover?.thumb_url ?? deck.cover?.url ?? null}
        blur={deck.cover?.blur}
        alt={deck.name}
        className="w-full aspect-square"
        fallback={<Layers size={24} className="text-muted-foreground/50" />}
      />
    </Link>
  )
}

function SearchNamedTile({
  href,
  icon,
  name,
  sub,
}: {
  href: string
  icon: React.ReactNode
  name: string
  sub?: string
}) {
  return (
    <Link
      href={href}
      className="shrink-0 w-44 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--palace)' }}>{icon}</span>
        <span className="font-medium text-sm truncate">{name}</span>
      </div>
      {sub && <span className="text-xs text-muted-foreground mt-auto">{sub}</span>}
    </Link>
  )
}

// 横断検索の結果表示
function SearchResultsView({
  results,
  searching,
}: {
  results: SearchResults | null
  searching: boolean
}) {
  const total = results
    ? results.items.length +
      results.decks.length +
      results.boxes.length +
      results.spaces.length +
      results.views.length
    : 0

  if (!results || (searching && total === 0)) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-32 rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
        一致する項目が見つかりませんでした。
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {results.items.length > 0 && (
        <ResultGroup icon={<GalleryHorizontal size={18} />} title="カード" count={results.items.length}>
          <Rail>
            {results.items.map((card) => (
              <SearchCardTile key={card.id} card={card} />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.decks.length > 0 && (
        <ResultGroup icon={<Layers size={18} />} title="デッキ" count={results.decks.length}>
          <Rail>
            {results.decks.map((deck) => (
              <SearchDeckTile key={deck.id} deck={deck} />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.boxes.length > 0 && (
        <ResultGroup icon={<BoxIcon size={18} />} title="ボックス" count={results.boxes.length}>
          <Rail>
            {results.boxes.map((box) => (
              <SearchNamedTile
                key={box.id}
                href={`/boxes/${box.id}`}
                icon={<BoxIcon size={16} />}
                name={box.name}
                sub={`${box.entry_count} 件`}
              />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.spaces.length > 0 && (
        <ResultGroup icon={<Frame size={18} />} title="スペース" count={results.spaces.length}>
          <Rail>
            {results.spaces.map((space) => (
              <SearchNamedTile
                key={space.id}
                href={`/spaces/${space.id}`}
                icon={<Frame size={16} />}
                name={space.name}
              />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.views.length > 0 && (
        <ResultGroup icon={<LayoutGrid size={18} />} title="キャンバス" count={results.views.length}>
          <Rail>
            {results.views.map((view) => (
              <SearchNamedTile
                key={view.id}
                href={`/views/${view.id}`}
                icon={<LayoutGrid size={16} />}
                name={view.name}
                sub="キャンバス"
              />
            ))}
          </Rail>
        </ResultGroup>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const [cards, setCards] = useState<Item[]>([])
  const [cardCount, setCardCount] = useState<number | undefined>(undefined)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [wordlists, setWordlists] = useState<Wordlist[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)
  // ライブラリ全体の選択モード（全形式を横断して選択 → 一括削除）
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isSelected = (type: SelectableType, id: string) => selectedKeys.has(selKey(type, id))

  const toggleSelect = (type: SelectableType, id: string) => {
    setSelectedKeys((prev) => {
      const key = selKey(type, id)
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setConfirmBulkDelete(false)
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedKeys(new Set())
    setConfirmBulkDelete(false)
  }

  // 2段階確認 → 形式ごとに削除（カードは bulk API、他形式は単体削除をまとめて実行）。
  // 成功したものだけをローカル状態から取り除く。
  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true)
      return
    }
    setDeleting(true)
    try {
      const byType: Record<SelectableType, string[]> = { card: [], box: [], space: [], view: [], wordlist: [] }
      for (const key of selectedKeys) {
        const idx = key.indexOf(':')
        const type = key.slice(0, idx) as SelectableType
        byType[type].push(key.slice(idx + 1))
      }

      // 単体削除APIを束ねて実行し、成功した ID のみ集める
      const deleteEach = async (ids: string[], fn: (id: string) => Promise<void>) => {
        const settled = await Promise.allSettled(ids.map((id) => fn(id).then(() => id)))
        return new Set(
          settled.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value)
        )
      }

      const [deletedCards, delBoxes, delSpaces, delViews, delWordlists] = await Promise.all([
        byType.card.length > 0 ? bulkDeleteItems(byType.card).then((ids) => new Set(ids)) : Promise.resolve(new Set<string>()),
        deleteEach(byType.box, deleteBox),
        deleteEach(byType.space, deleteSpace),
        deleteEach(byType.view, deleteView),
        deleteEach(byType.wordlist, deleteWordlist),
      ])

      if (deletedCards.size > 0) {
        setCards((prev) => prev.filter((c) => !deletedCards.has(c.id)))
        setCardCount((prev) => (prev === undefined ? prev : Math.max(0, prev - deletedCards.size)))
      }
      if (delBoxes.size > 0) setBoxes((prev) => prev.filter((c) => !delBoxes.has(c.id)))
      if (delSpaces.size > 0) setSpaces((prev) => prev.filter((s) => !delSpaces.has(s.id)))
      if (delViews.size > 0) setViews((prev) => prev.filter((v) => !delViews.has(v.id)))
      if (delWordlists.size > 0) setWordlists((prev) => prev.filter((w) => !delWordlists.has(w.id)))

      exitSelection()
    } finally {
      setDeleting(false)
    }
  }

  const selectedCount = selectedKeys.size

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([getItemsPage(1, PREVIEW_LIMIT), getItemsSummary(), getBoxes(), getSpaces(), getViews(), getWordlists()])
      .then(([itemsRes, summaryRes, boxesRes, spacesRes, viewsRes, wordlistsRes]) => {
        if (cancelled) return
        if (itemsRes.status === 'fulfilled') setCards(itemsRes.value.items)
        if (summaryRes.status === 'fulfilled') setCardCount(summaryRes.value.total_count)
        if (boxesRes.status === 'fulfilled') setBoxes(boxesRes.value)
        if (spacesRes.status === 'fulfilled') setSpaces(spacesRes.value)
        if (viewsRes.status === 'fulfilled') setViews(viewsRes.value)
        if (wordlistsRes.status === 'fulfilled') setWordlists(wordlistsRes.value)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 横断検索（デバウンス）
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    const handle = setTimeout(() => {
      searchLibrary(q)
        .then((res) => {
          if (!cancelled) setResults(res)
        })
        .catch(() => {
          if (!cancelled) setResults({ items: [], decks: [], boxes: [], spaces: [], views: [] })
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setSearching(value.trim().length > 0)
  }

  const clearQuery = () => {
    setQuery('')
    setSearching(false)
  }

  const hasQuery = query.trim().length > 0
  const roadSpaces = spaces.filter((s) => s.space_type === 'road')
  const roomSpaces = spaces.filter((s) => s.space_type === 'room')
  const deckViews = views.filter((v) => v.view_type === 'deck')
  const freeboardViews = views.filter((v) => v.view_type === 'freeboard')
  const spaceMapViews = views.filter((v) => v.view_type === 'space_map')

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-32 w-32 rounded-xl shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <LibraryBig size={26} style={{ color: 'var(--palace)' }} />
            ライブラリ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            カード・ボックスなど、形式ごとに知識を棚で見渡せます。
          </p>
        </div>
        {/* ライブラリ全体の選択（全形式横断）。検索中は非表示。 */}
        {!hasQuery &&
          (selectionMode ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="whitespace-nowrap text-sm text-muted-foreground">{selectedCount}件を選択中</span>
              <Button
                variant={confirmBulkDelete ? 'destructive' : 'outline'}
                size="sm"
                disabled={selectedCount === 0 || deleting}
                onClick={handleBulkDelete}
                onBlur={() => setConfirmBulkDelete(false)}
                className="flex items-center gap-1"
              >
                <Trash2 size={14} />
                {deleting ? '削除中…' : confirmBulkDelete ? '本当に削除' : '削除'}
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelection}>
                キャンセル
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="flex shrink-0 items-center gap-1"
            >
              <CheckSquare size={14} />
              選択
            </Button>
          ))}
      </div>

      {/* 横断検索 */}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="カード・デッキ・ボックス・スペース・キャンバスを横断検索"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-10 text-sm outline-none focus:border-[var(--palace)] focus:ring-1 focus:ring-[var(--palace)]"
          aria-label="ライブラリ横断検索"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="検索をクリア"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {hasQuery ? (
        <SearchResultsView results={results} searching={searching} />
      ) : (
        <>
      {/* カード */}
      <Shelf
        icon={<GalleryHorizontal size={20} />}
        title="カード"
        count={cardCount}
        href={selectionMode ? undefined : '/items'}
        action={
          selectionMode ? undefined : (
            <Link href="/items/new">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Plus size={14} />
                作成
              </Button>
            </Link>
          )
        }
      >
        {cards.length === 0 ? (
          <EmptyRail
            message="まだカードがありません。"
            cta={<Link href="/items/new"><Button size="sm">カードを作成</Button></Link>}
          />
        ) : (
          <Rail>
            {cards.map((item) => (
              <CardThumb
                key={item.id}
                item={item}
                selectionMode={selectionMode}
                selected={isSelected('card', item.id)}
                onToggle={() => toggleSelect('card', item.id)}
              />
            ))}
          </Rail>
        )}
      </Shelf>

      {/* ボックス */}
      <Shelf
        icon={<BoxIcon size={20} />}
        title="ボックス"
        count={boxes.length}
        href={selectionMode ? undefined : '/boxes'}
      >
        {boxes.length === 0 ? (
          <EmptyRail
            message="まだボックスがありません。"
            cta={<Link href="/boxes"><Button size="sm">ボックスを作成</Button></Link>}
          />
        ) : (
          <Rail>
            {boxes.slice(0, PREVIEW_LIMIT).map((box) => (
              <BoxTile
                key={box.id}
                box={box}
                selectionMode={selectionMode}
                selected={isSelected('box', box.id)}
                onToggle={() => toggleSelect('box', box.id)}
              />
            ))}
          </Rail>
        )}
      </Shelf>

      {/* キャンバス（表示・学習形式：デッキ / フリーボード等） */}
      <Section icon={<LayoutGrid size={22} />} title="キャンバス" description="カードの表示・学習形式">
        <Shelf icon={<Layers size={18} />} title="デッキ" count={deckViews.length} href={selectionMode ? undefined : '/views?type=deck'}>
          {deckViews.length === 0 ? (
            <EmptyRail
              message="まだデッキがありません。"
              cta={<Link href="/views?type=deck"><Button size="sm">デッキを作成</Button></Link>}
            />
          ) : (
            <Rail>
              {deckViews.slice(0, PREVIEW_LIMIT).map((view) => (
                <ViewTile
                  key={view.id}
                  view={view}
                  selectionMode={selectionMode}
                  selected={isSelected('view', view.id)}
                  onToggle={() => toggleSelect('view', view.id)}
                />
              ))}
            </Rail>
          )}
        </Shelf>
        <Shelf icon={<LayoutGrid size={18} />} title="フリーボード" count={freeboardViews.length} href={selectionMode ? undefined : '/views?type=freeboard'}>
          {freeboardViews.length === 0 ? (
            <EmptyRail
              message="まだフリーボードがありません。"
              cta={<Link href="/views?type=freeboard"><Button size="sm">作成</Button></Link>}
            />
          ) : (
            <Rail>
              {freeboardViews.slice(0, PREVIEW_LIMIT).map((view) => (
                <ViewTile
                  key={view.id}
                  view={view}
                  selectionMode={selectionMode}
                  selected={isSelected('view', view.id)}
                  onToggle={() => toggleSelect('view', view.id)}
                />
              ))}
            </Rail>
          )}
        </Shelf>
        <Shelf icon={<MapPin size={18} />} title="スペース配置" count={spaceMapViews.length} href={selectionMode ? undefined : '/views?type=space_map'}>
          {spaceMapViews.length === 0 ? (
            <EmptyRail
              message="まだスペース配置がありません。"
              cta={<Link href="/views?type=space_map"><Button size="sm">作成</Button></Link>}
            />
          ) : (
            <Rail>
              {spaceMapViews.slice(0, PREVIEW_LIMIT).map((view) => (
                <ViewTile
                  key={view.id}
                  view={view}
                  selectionMode={selectionMode}
                  selected={isSelected('view', view.id)}
                  onToggle={() => toggleSelect('view', view.id)}
                />
              ))}
            </Rail>
          )}
        </Shelf>
      </Section>

      {/* スペース（記憶の空間：ロード / ルーム） */}
      <Section icon={<Frame size={22} />} title="スペース" description="記憶の空間">
        {spaces.length === 0 ? (
          <EmptyRail
            message="まだスペースがありません。"
            cta={<Link href="/spaces"><Button size="sm">スペースを作成</Button></Link>}
          />
        ) : (
          <>
            <Shelf icon={<Route size={18} />} title="ロード" count={roadSpaces.length} href={selectionMode ? undefined : '/spaces?type=road'}>
              {roadSpaces.length === 0 ? (
                <EmptyRail message="ロードはまだありません。" cta={<Link href="/spaces?type=road"><Button size="sm">作成</Button></Link>} />
              ) : (
                <Rail>
                  {roadSpaces.slice(0, PREVIEW_LIMIT).map((space) => (
                    <SpaceTile
                      key={space.id}
                      space={space}
                      selectionMode={selectionMode}
                      selected={isSelected('space', space.id)}
                      onToggle={() => toggleSelect('space', space.id)}
                    />
                  ))}
                </Rail>
              )}
            </Shelf>
            <Shelf icon={<DoorOpen size={18} />} title="ルーム" count={roomSpaces.length} href={selectionMode ? undefined : '/spaces?type=room'}>
              {roomSpaces.length === 0 ? (
                <EmptyRail message="ルームはまだありません。" cta={<Link href="/spaces?type=room"><Button size="sm">作成</Button></Link>} />
              ) : (
                <Rail>
                  {roomSpaces.slice(0, PREVIEW_LIMIT).map((space) => (
                    <SpaceTile
                      key={space.id}
                      space={space}
                      selectionMode={selectionMode}
                      selected={isSelected('space', space.id)}
                      onToggle={() => toggleSelect('space', space.id)}
                    />
                  ))}
                </Rail>
              )}
            </Shelf>
          </>
        )}
      </Section>

      {/* マテリアル（カード化の前の素材） */}
      <Section icon={<Boxes size={22} />} title="マテリアル" description="カード化の前の素材">
        <Shelf icon={<ListChecks size={18} />} title="ワードリスト" count={wordlists.length} href={selectionMode ? undefined : '/wordlists'}>
          {wordlists.length === 0 ? (
            <EmptyRail
              message="まだワードリストがありません。"
              cta={<Link href="/wordlists/new"><Button size="sm">ワードリストを作成</Button></Link>}
            />
          ) : (
            <Rail>
              {wordlists.slice(0, PREVIEW_LIMIT).map((wordlist) => (
                <WordlistTile
                  key={wordlist.id}
                  wordlist={wordlist}
                  selectionMode={selectionMode}
                  selected={isSelected('wordlist', wordlist.id)}
                  onToggle={() => toggleSelect('wordlist', wordlist.id)}
                />
              ))}
            </Rail>
          )}
        </Shelf>
        <Shelf icon={<Images size={18} />} title="ピクチャーリスト">
          <EmptyRail message="準備中です。画像素材をまとめられるようにする予定です。" />
        </Shelf>
      </Section>
        </>
      )}
    </div>
  )
}
