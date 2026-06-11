'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GalleryHorizontal, Layers, LayoutGrid, Frame, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItems, getItemsSummary } from '@/lib/api/items'
import { getCollections } from '@/lib/api/collections'
import { getSpaces } from '@/lib/api/spaces'
import { getViews } from '@/lib/api/views'
import type { Item } from '@/types/item'
import type { Collection } from '@/types/collection'
import type { Space } from '@/types/space'
import type { View } from '@/types/view'

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
      <span className="text-xs text-muted-foreground mt-auto">{collection.item_count} 枚</span>
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
      <span className="text-xs text-muted-foreground mt-auto">フリーボード</span>
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

export default function LibraryPage() {
  const [cards, setCards] = useState<Item[]>([])
  const [cardCount, setCardCount] = useState<number | undefined>(undefined)
  const [collections, setCollections] = useState<Collection[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([getItems(), getItemsSummary(), getCollections(), getSpaces(), getViews()])
      .then(([itemsRes, summaryRes, collectionsRes, spacesRes, viewsRes]) => {
        if (cancelled) return
        if (itemsRes.status === 'fulfilled') setCards(itemsRes.value.slice(0, PREVIEW_LIMIT))
        if (summaryRes.status === 'fulfilled') setCardCount(summaryRes.value.total_count)
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
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
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <div>
        <h1 className="text-xl font-semibold">ライブラリ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          カード・コレクションなど、形式ごとに知識を棚で見渡せます。
        </p>
      </div>

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

      {/* コレクション / デッキ */}
      <Shelf
        icon={<Layers size={20} />}
        title="コレクション / デッキ"
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
    </div>
  )
}
