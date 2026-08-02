'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { GalleryHorizontal, Box as BoxIcon, Layers, LayoutGrid, Frame, MapPin, ChevronRight, Search, X, Route, DoorOpen, ListChecks, Boxes, Images, CheckSquare, Square, Trash2, LibraryBig } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { readPageCache, writePageCache } from '@/lib/page-cache'
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
import type { SearchResults } from '@/types/search'
import { CardImage } from '@/components/ui/card-image'
import { Rail, EmptyRail } from '@/components/features/library/primitives'
import { SearchResultsView } from '@/components/features/library/SearchResults'
import { ShelfGroup, SurfaceBoard } from '@/components/features/display/ShelfBoard'
import { EntityFrame } from '@/components/features/display/EntityFrame'
import { CardCreateButton, CardCreatePanelSlot } from '@/components/features/items/CardCreatePanel'
import { LibraryCreateButton, LibraryCreatePanels } from '@/components/features/library/LibraryCreate'

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
  description,
  count,
  href,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
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
    // 縦棚を横に並べたとき列の高さが揃うよう、棚そのものを縦の flex にして伸ばす
    <section className="flex h-full flex-col gap-3">
      {/* 見出しと説明は縦に積む。横に並べると見出しが読み取りにくくなるため */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {/* 宮殿スタイルでは 1 段を棚板の上に載せる（シンプルでは素通し） */}
      <SurfaceBoard surface="library">{children}</SurfaceBoard>
    </section>
  )
}

// 傘セクション（キャンバス / スペース）の見出し＋配下のサブ棚をまとめる枠。
// 棚が縦に長くなるため、見出しから畳めるようにしている。
// 畳んだ状態は覚えない（ページを開き直したら全部開いている）。
// 覚えるほど頻繁に切り替えるものではなく、隠れたまま気付かない方が困るため。
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
  const [open, setOpen] = useState(true)

  return (
    <section className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group flex items-center gap-2 rounded-md transition-colors hover:text-[var(--palace)]"
        >
          <span style={{ color: 'var(--palace)' }}>{icon}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
          <ChevronRight
            size={18}
            className={`text-muted-foreground transition-transform group-hover:text-[var(--palace)] ${
              open ? 'rotate-90' : ''
            }`}
          />
        </button>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {open && <ShelfGroup className="border-l border-border/60 pl-4">{children}</ShelfGroup>}
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
        framed
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
// デッキはカード（w-32）と他のキャンバス（w-40）の中間。束ねたカードであることを大きさでも示す
const DECK_TILE_CLASS = 'shrink-0 w-36 flex flex-col rounded-xl border overflow-hidden bg-card transition-shadow'

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
      <EntityFrame kind="box">
        <div className="w-full aspect-square bg-muted overflow-hidden">
          <EntityCover cover={box} />
        </div>
      </EntityFrame>
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
      <EntityFrame kind="mineral">
        <div className="w-full aspect-square bg-muted flex items-center justify-center">
          <ListChecks size={28} className="text-muted-foreground/50" />
        </div>
      </EntityFrame>
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
      <EntityFrame kind={space.space_type === 'road' ? 'road' : 'space'}>
        <div className="w-full aspect-square bg-muted overflow-hidden">
          <EntityCover cover={space} fallback={<SpaceCoverFallback spaceType={space.space_type} />} />
        </div>
      </EntityFrame>
    </SelectableTile>
  )
}

function ViewTile({ view, selectionMode, selected, onToggle }: { view: View } & TileSelectionProps) {
  const isDeck = view.view_type === 'deck'
  return (
    <SelectableTile
      href={`/views/${view.id}`}
      className={isDeck ? DECK_TILE_CLASS : NAMED_TILE_CLASS}
      selectionMode={selectionMode}
      selected={selected}
      onToggle={onToggle}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{view.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{viewTypeLabel(view.view_type)}</span>
      </div>
      <EntityFrame kind={isDeck ? 'deck' : view.view_type === 'freeboard' ? 'board' : 'frame'}>
        <div className="w-full aspect-square bg-muted overflow-hidden">
          <EntityCover cover={view} />
        </div>
      </EntityFrame>
    </SelectableTile>
  )
}

// 再訪時にまず描く内容。取得が終われば上書きされる
type LibrarySnapshot = {
  cards: Item[]
  cardCount?: number
  boxes: Box[]
  wordlists: Wordlist[]
  spaces: Space[]
  views: View[]
}

const CACHE_KEY = 'library'

// 棚 1 本に並べる件数。1 画面に収まる程度より少し多め（横に送れる分の余裕）
const SHELF_LIMIT = 24

// 続きを取るときの取得元。棚ごとに増やす件数は同じ
type ShelfKind = 'views' | 'spaces' | 'boxes' | 'wordlists'

export default function LibraryPage() {
  // 前回描いていた内容があれば、それを初期値にして即座に描く。
  // 取得は従来どおり裏で走り、終わり次第上書きする。
  const [cached] = useState(() => readPageCache<LibrarySnapshot>(CACHE_KEY))

  const [cards, setCards] = useState<Item[]>(cached?.cards ?? [])
  const [cardCount, setCardCount] = useState<number | undefined>(cached?.cardCount)
  const [boxes, setBoxes] = useState<Box[]>(cached?.boxes ?? [])
  const [wordlists, setWordlists] = useState<Wordlist[]>(cached?.wordlists ?? [])
  const [spaces, setSpaces] = useState<Space[]>(cached?.spaces ?? [])
  const [views, setViews] = useState<View[]>(cached?.views ?? [])
  // 描くものが既にあるなら、読み込み中の表示は出さない
  const [loading, setLoading] = useState(!cached)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)
  // ライブラリ全体の選択モード（全形式を横断して選択 → 一括削除）
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /*
    棚の末尾まで送られたら続きを取る。

    取り直す件数を増やして取り直す方式にしている。差分だけを継ぎ足す方が
    転送量は小さいが、継ぎ足しの順序や重複を自前で管理することになり、
    作成・削除の反映とぶつかったときに食い違いが出る。
    棚は数十件で頭打ちなので、丸ごと置き換える方が安全で、
    キャッシュ（画面の内容をそのまま写す）ともそのまま噛み合う。
  */
  const [shelfLimits, setShelfLimits] = useState<Record<ShelfKind, number>>({
    views: SHELF_LIMIT,
    spaces: SHELF_LIMIT,
    boxes: SHELF_LIMIT,
    wordlists: SHELF_LIMIT,
  })
  const loadingShelf = useRef<Set<ShelfKind>>(new Set())

  const loadMoreShelf = useCallback(
    async (kind: ShelfKind, current: number) => {
      // 取得済みが上限に届いていなければ、まだ続きは無い
      if (current < shelfLimits[kind] || loadingShelf.current.has(kind)) return
      loadingShelf.current.add(kind)
      const next = shelfLimits[kind] + SHELF_LIMIT
      try {
        if (kind === 'views') setViews(await getViews(next))
        if (kind === 'spaces') setSpaces(await getSpaces(next))
        if (kind === 'boxes') setBoxes(await getBoxes(next))
        if (kind === 'wordlists') setWordlists(await getWordlists(next))
        setShelfLimits((prev) => ({ ...prev, [kind]: next }))
      } catch {
        // 失敗しても取得済みの分は残す。もう一度末尾へ送れば再試行される
      } finally {
        loadingShelf.current.delete(kind)
      }
    },
    [shelfLimits]
  )

  // 画面の内容をそのままキャッシュに写す。作成・削除で state を触った結果も
  // ここを通るので、キャッシュだけ古いという食い違いが起きない。
  useEffect(() => {
    if (loading) return
    writePageCache<LibrarySnapshot>(CACHE_KEY, { cards, cardCount, boxes, wordlists, spaces, views })
  }, [loading, cards, cardCount, boxes, wordlists, spaces, views])

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
    Promise.allSettled([
      getItemsPage(1, PREVIEW_LIMIT),
      getItemsSummary(),
      // 棚は先頭の数件しか見せないので、その分だけ取る。
      // 全件見たいときは棚の見出しから一覧ページへ移れる。
      getBoxes(SHELF_LIMIT),
      getSpaces(SHELF_LIMIT),
      getViews(SHELF_LIMIT),
      getWordlists(SHELF_LIMIT),
    ])
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
      {/* 右パネルでの作成。開いているセクションの分だけがパネルへ描かれる */}
      <CardCreatePanelSlot />
      <LibraryCreatePanels
        onViewCreated={(v) => setViews((prev) => [v, ...prev])}
        onSpaceCreated={(sp) => setSpaces((prev) => [sp, ...prev])}
        onBoxCreated={(b) => setBoxes((prev) => [b, ...prev])}
        onWordlistCreated={(w) => setWordlists((prev) => [w, ...prev])}
      />
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
        <ShelfGroup>
      {/* カード */}
      <Shelf
        icon={<GalleryHorizontal size={20} />}
        title="カード"
        count={cardCount}
        href={selectionMode ? undefined : '/items'}
        action={
          selectionMode ? undefined : (
            <CardCreateButton />
          )
        }
      >
        {cards.length === 0 ? (
          <EmptyRail
            message="まだカードがありません。"
            cta={<CardCreateButton variant="default" label="カードを作成" />}
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

      {/* キャンバス（表示・学習形式：デッキ / フリーボード等） */}
      <Section icon={<LayoutGrid size={22} />} title="キャンバス" description="カードの表示・学習形式">
        <Shelf icon={<Layers size={18} />} title="デッキ" count={deckViews.length} href={selectionMode ? undefined : '/views?type=deck'} action={selectionMode ? undefined : <LibraryCreateButton kind="deck" />}>
          {deckViews.length === 0 ? (
            <EmptyRail
              message="まだデッキがありません。"
              cta={<Link href="/views?type=deck"><Button size="sm">デッキを作成</Button></Link>}
            />
          ) : (
            <Rail onEndReached={() => loadMoreShelf('views', views.length)}>
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
        <Shelf icon={<LayoutGrid size={18} />} title="フリーボード" count={freeboardViews.length} href={selectionMode ? undefined : '/views?type=freeboard'} action={selectionMode ? undefined : <LibraryCreateButton kind="freeboard" />}>
          {freeboardViews.length === 0 ? (
            <EmptyRail
              message="まだフリーボードがありません。"
              cta={<Link href="/views?type=freeboard"><Button size="sm">作成</Button></Link>}
            />
          ) : (
            <Rail onEndReached={() => loadMoreShelf('views', views.length)}>
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
        <Shelf icon={<MapPin size={18} />} title="スペース配置" count={spaceMapViews.length} href={selectionMode ? undefined : '/views?type=space_map'} action={selectionMode ? undefined : <LibraryCreateButton kind="space_map" />}>
          {spaceMapViews.length === 0 ? (
            <EmptyRail
              message="まだスペース配置がありません。"
              cta={<Link href="/views?type=space_map"><Button size="sm">作成</Button></Link>}
            />
          ) : (
            <Rail onEndReached={() => loadMoreShelf('views', views.length)}>
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
            <Shelf icon={<Route size={18} />} title="ロード" count={roadSpaces.length} href={selectionMode ? undefined : '/spaces?type=road'} action={selectionMode ? undefined : <LibraryCreateButton kind="road" />}>
              {roadSpaces.length === 0 ? (
                <EmptyRail message="ロードはまだありません。" cta={<Link href="/spaces?type=road"><Button size="sm">作成</Button></Link>} />
              ) : (
                <Rail onEndReached={() => loadMoreShelf('spaces', spaces.length)}>
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
            <Shelf icon={<DoorOpen size={18} />} title="ルーム" count={roomSpaces.length} href={selectionMode ? undefined : '/spaces?type=room'} action={selectionMode ? undefined : <LibraryCreateButton kind="room" />}>
              {roomSpaces.length === 0 ? (
                <EmptyRail message="ルームはまだありません。" cta={<Link href="/spaces?type=room"><Button size="sm">作成</Button></Link>} />
              ) : (
                <Rail onEndReached={() => loadMoreShelf('spaces', spaces.length)}>
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

      {/* ボックス */}
      <Shelf
        icon={<BoxIcon size={20} />}
        title="ボックス"
        description="用途を問わない収納箱"
        count={boxes.length}
        action={selectionMode ? undefined : <LibraryCreateButton kind="box" />}
        href={selectionMode ? undefined : '/boxes'}
      >
        {boxes.length === 0 ? (
          <EmptyRail
            message="まだボックスがありません。"
            cta={<Link href="/boxes"><Button size="sm">ボックスを作成</Button></Link>}
          />
        ) : (
          <Rail onEndReached={() => loadMoreShelf('boxes', boxes.length)}>
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

      {/* マテリアル（カード化の前の素材） */}
      <Section icon={<Boxes size={22} />} title="マテリアル" description="カード化の前の素材">
        <Shelf
          icon={<ListChecks size={18} />}
          title="ワードリスト"
          count={wordlists.length}
          href={selectionMode ? undefined : '/wordlists'}
          action={selectionMode ? undefined : <LibraryCreateButton kind="wordlist" />}
        >
          {wordlists.length === 0 ? (
            <EmptyRail
              message="まだワードリストがありません。"
              cta={<Link href="/wordlists/new"><Button size="sm">ワードリストを作成</Button></Link>}
            />
          ) : (
            <Rail onEndReached={() => loadMoreShelf('wordlists', wordlists.length)}>
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
        </ShelfGroup>
      )}
    </div>
  )
}
