'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GalleryHorizontal, Library, Layers, LayoutGrid, Frame, ChevronRight, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItems, getItemsSummary } from '@/lib/api/items'
import { getDecks } from '@/lib/api/decks'
import { getCollections } from '@/lib/api/collections'
import { getSpaces } from '@/lib/api/spaces'
import { getViews } from '@/lib/api/views'
import { searchLibrary } from '@/lib/api/search'
import type { Item } from '@/types/item'
import type { Deck } from '@/types/deck'
import type { Collection } from '@/types/collection'
import type { Space } from '@/types/space'
import type { View } from '@/types/view'
import { viewTypeLabel } from '@/lib/view-types'
import { spaceTypeLabel } from '@/lib/space-types'
import type { SearchResults, SearchCard, SearchDeck } from '@/types/search'

const PREVIEW_LIMIT = 12

// シェルフ共通の枠（見出し＋「すべて見る」＋横スクロールの中身）
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
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--palace)' }}>{icon}</span>
          <h2 className="text-base font-semibold">{title}</h2>
          {typeof count === 'number' && (
            <span className="text-sm text-muted-foreground">{count}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {href && (
            <Link
              href={href}
              className="flex items-center gap-0.5 text-sm hover:underline"
              style={{ color: 'var(--palace)' }}
            >
              すべて見る
              <ChevronRight size={15} />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function CardThumb({ item }: { item: Item }) {
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  return (
    <Link
      href={`/items/${item.id}`}
      className="shrink-0 w-32 flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-muted-foreground text-[11px] px-2 text-center">{item.title}</span>
        )}
      </div>
      <span className="px-2 py-1.5 text-xs font-medium truncate">{item.title}</span>
    </Link>
  )
}

function DeckTile({ deck }: { deck: Deck }) {
  const coverUrl = deck.cover?.thumb_url ?? deck.cover?.url ?? null
  return (
    <Link
      href={`/decks/${deck.id}`}
      className="shrink-0 w-40 flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={deck.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Library size={24} className="text-muted-foreground/50" />
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{deck.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{deck.item_count}</span>
      </div>
    </Link>
  )
}

function CollectionTile({ collection }: { collection: Collection }) {
  return (
    <Link
      href={`/collections/${collection.id}`}
      className="shrink-0 w-44 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2">
        <Layers size={16} style={{ color: 'var(--palace)' }} />
        <span className="font-medium text-sm truncate">{collection.name}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-auto">{collection.entry_count} 件</span>
    </Link>
  )
}

function SpaceTile({ space }: { space: Space }) {
  return (
    <Link
      href={`/spaces/${space.id}`}
      className="shrink-0 w-44 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2">
        <LayoutGrid size={16} style={{ color: 'var(--palace)' }} />
        <span className="font-medium text-sm truncate">{space.name}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{spaceTypeLabel(space.space_type)}</span>
      </div>
      {space.description && (
        <span className="text-xs text-muted-foreground line-clamp-2">{space.description}</span>
      )}
    </Link>
  )
}

function ViewTile({ view }: { view: View }) {
  return (
    <Link
      href={`/views/${view.id}`}
      className="shrink-0 w-44 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2">
        <Frame size={16} style={{ color: 'var(--palace)' }} />
        <span className="font-medium text-sm truncate">{view.name}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-auto">{viewTypeLabel(view.view_type)}</span>
    </Link>
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
  const imageUrl = card.media?.thumb_url ?? card.media?.url ?? null
  return (
    <Link
      href={`/items/${card.id}`}
      className="shrink-0 w-32 flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={card.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-muted-foreground text-[11px] px-2 text-center">{card.title}</span>
        )}
      </div>
      <span className="px-2 py-1.5 text-xs font-medium truncate">{card.title}</span>
    </Link>
  )
}

function SearchDeckTile({ deck }: { deck: SearchDeck }) {
  const coverUrl = deck.cover?.thumb_url ?? deck.cover?.url ?? null
  return (
    <Link
      href={`/decks/${deck.id}`}
      className="shrink-0 w-40 flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={deck.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Library size={24} className="text-muted-foreground/50" />
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{deck.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{deck.item_count}</span>
      </div>
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
      results.collections.length +
      results.spaces.length +
      results.views.length
    : 0

  if (!results || (searching && total === 0)) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-32 rounded-xl bg-muted animate-pulse shrink-0" />
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
        <ResultGroup icon={<Library size={18} />} title="デッキ" count={results.decks.length}>
          <Rail>
            {results.decks.map((deck) => (
              <SearchDeckTile key={deck.id} deck={deck} />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.collections.length > 0 && (
        <ResultGroup icon={<Layers size={18} />} title="コレクション" count={results.collections.length}>
          <Rail>
            {results.collections.map((collection) => (
              <SearchNamedTile
                key={collection.id}
                href={`/collections/${collection.id}`}
                icon={<Layers size={16} />}
                name={collection.name}
                sub={`${collection.entry_count} 件`}
              />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.spaces.length > 0 && (
        <ResultGroup icon={<LayoutGrid size={18} />} title="スペース" count={results.spaces.length}>
          <Rail>
            {results.spaces.map((space) => (
              <SearchNamedTile
                key={space.id}
                href={`/spaces/${space.id}`}
                icon={<LayoutGrid size={16} />}
                name={space.name}
              />
            ))}
          </Rail>
        </ResultGroup>
      )}
      {results.views.length > 0 && (
        <ResultGroup icon={<Frame size={18} />} title="ビュー" count={results.views.length}>
          <Rail>
            {results.views.map((view) => (
              <SearchNamedTile
                key={view.id}
                href={`/views/${view.id}`}
                icon={<Frame size={16} />}
                name={view.name}
                sub="ビュー"
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
  const [decks, setDecks] = useState<Deck[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([getItems(), getItemsSummary(), getDecks(), getCollections(), getSpaces(), getViews()])
      .then(([itemsRes, summaryRes, decksRes, collectionsRes, spacesRes, viewsRes]) => {
        if (cancelled) return
        if (itemsRes.status === 'fulfilled') setCards(itemsRes.value.slice(0, PREVIEW_LIMIT))
        if (summaryRes.status === 'fulfilled') setCardCount(summaryRes.value.total_count)
        if (decksRes.status === 'fulfilled') setDecks(decksRes.value)
        if (collectionsRes.status === 'fulfilled') setCollections(collectionsRes.value)
        if (spacesRes.status === 'fulfilled') setSpaces(spacesRes.value)
        if (viewsRes.status === 'fulfilled') setViews(viewsRes.value)
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
          if (!cancelled) setResults({ items: [], decks: [], collections: [], spaces: [], views: [] })
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="flex gap-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-32 w-32 rounded-xl bg-muted animate-pulse shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <div>
        <h1 className="text-xl font-semibold">ライブラリ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          カード・コレクションなど、形式ごとに知識を棚で見渡せます。
        </p>
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
          placeholder="カード・デッキ・コレクション・スペース・ビューを横断検索"
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
        href="/items"
        action={
          <Link href="/items/new">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Plus size={14} />
              作成
            </Button>
          </Link>
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
              <CardThumb key={item.id} item={item} />
            ))}
          </Rail>
        )}
      </Shelf>

      {/* デッキ（カードを束ねる） */}
      <Shelf
        icon={<Library size={20} />}
        title="デッキ"
        count={decks.length}
        href="/decks"
      >
        {decks.length === 0 ? (
          <EmptyRail
            message="まだデッキがありません。"
            cta={<Link href="/decks"><Button size="sm">デッキを作成</Button></Link>}
          />
        ) : (
          <Rail>
            {decks.slice(0, PREVIEW_LIMIT).map((deck) => (
              <DeckTile key={deck.id} deck={deck} />
            ))}
          </Rail>
        )}
      </Shelf>

      {/* コレクション（デッキを束ねる） */}
      <Shelf
        icon={<Layers size={20} />}
        title="コレクション"
        count={collections.length}
        href="/collections"
      >
        {collections.length === 0 ? (
          <EmptyRail
            message="まだコレクションがありません。"
            cta={<Link href="/collections"><Button size="sm">コレクションを作成</Button></Link>}
          />
        ) : (
          <Rail>
            {collections.slice(0, PREVIEW_LIMIT).map((collection) => (
              <CollectionTile key={collection.id} collection={collection} />
            ))}
          </Rail>
        )}
      </Shelf>

      {/* スペース */}
      <Shelf
        icon={<LayoutGrid size={20} />}
        title="スペース"
        count={spaces.length}
        href="/spaces"
      >
        {spaces.length === 0 ? (
          <EmptyRail
            message="まだスペースがありません。"
            cta={<Link href="/spaces"><Button size="sm">スペースを作成</Button></Link>}
          />
        ) : (
          <Rail>
            {spaces.slice(0, PREVIEW_LIMIT).map((space) => (
              <SpaceTile key={space.id} space={space} />
            ))}
          </Rail>
        )}
      </Shelf>

      {/* ビュー（フリーボード） */}
      <Shelf
        icon={<Frame size={20} />}
        title="ビュー"
        count={views.length}
        href="/views"
      >
        {views.length === 0 ? (
          <EmptyRail
            message="まだビューがありません。"
            cta={<Link href="/views"><Button size="sm">ビューを作成</Button></Link>}
          />
        ) : (
          <Rail>
            {views.slice(0, PREVIEW_LIMIT).map((view) => (
              <ViewTile key={view.id} view={view} />
            ))}
          </Rail>
        )}
      </Shelf>
        </>
      )}
    </div>
  )
}
