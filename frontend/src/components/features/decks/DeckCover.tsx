'use client'

import { useState } from 'react'
import { Layers, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Deck } from '@/types/deck'
import type { ItemMedia } from '@/types/item'

type CoverDeck = Pick<Deck, 'name' | 'cover_type' | 'cover_images' | 'cover_image' | 'cover'>

function mediaUrl(m: ItemMedia | { thumb_url?: string; url?: string } | null | undefined): string | null {
  return m?.thumb_url ?? m?.url ?? null
}

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Layers size={24} className="text-muted-foreground/50" />
    </div>
  )
}

// first_card: 先頭カードを表示し、ホバー時に左右の矢印・インジケータでカードを切り替える
function FirstCard({ images, name }: { images: ItemMedia[]; name: string }) {
  const [idx, setIdx] = useState(0)
  if (images.length === 0) return <Placeholder />

  const safeIdx = idx % images.length
  const url = mediaUrl(images[safeIdx])
  const hasMultiple = images.length > 1

  const step = (e: React.MouseEvent, delta: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx((i) => (i + delta + images.length) % images.length)
  }

  return (
    <div className="group/cover relative h-full w-full">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Placeholder />
      )}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => step(e, -1)}
            aria-label="前のカード"
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 hover:bg-black/60"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => step(e, 1)}
            aria-label="次のカード"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 hover:bg-black/60"
          >
            <ChevronRight size={16} />
          </button>
          <div className="pointer-events-none absolute bottom-1 left-0 right-0 flex justify-center gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
            {images.map((m, i) => (
              <span
                key={m.id ?? i}
                className={`h-1.5 w-1.5 rounded-full ${i === safeIdx ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// collage: 最大4枚を2x2で表示。不足分はプレースホルダで埋める
function Collage({ images, name }: { images: ItemMedia[]; name: string }) {
  if (images.length === 0) return <Placeholder />

  const cells = Array.from({ length: 4 }, (_, i) => images[i] ?? null)
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border">
      {cells.map((m, i) => {
        const url = mediaUrl(m)
        return url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m?.id ?? i} src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div key={i} className="flex items-center justify-center bg-muted">
            <Layers size={14} className="text-muted-foreground/40" />
          </div>
        )
      })}
    </div>
  )
}

/**
 * デッキカバーをモード（first_card / collage / custom）に応じて描画する。
 * 親が正方形の枠（aspect-square）を与え、本コンポーネントはその枠を満たす。
 */
export function DeckCover({ deck }: { deck: CoverDeck }) {
  const images = deck.cover_images ?? []
  const type = deck.cover_type ?? 'first_card'

  if (type === 'custom') {
    const url = mediaUrl(deck.cover_image) ?? mediaUrl(deck.cover)
    if (!url) return <Placeholder />
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={deck.name} className="h-full w-full object-cover" loading="lazy" />
    )
  }

  if (type === 'collage') return <Collage images={images} name={deck.name} />

  return <FirstCard images={images} name={deck.name} />
}
