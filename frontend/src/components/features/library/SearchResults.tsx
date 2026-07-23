import Link from 'next/link'
import type { ReactNode } from 'react'
import { GalleryHorizontal, Box as BoxIcon, Layers, LayoutGrid, Frame } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { CardImage } from '@/components/ui/card-image'
import type { SearchResults, SearchCard, SearchDeck } from '@/types/search'
import { Rail } from './primitives'

// 横断検索のグループ見出し
function ResultGroup({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode
  title: string
  count: number
  children: ReactNode
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
  icon: ReactNode
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
export function SearchResultsView({
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
