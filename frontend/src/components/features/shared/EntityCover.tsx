'use client'

import { useState, type ReactNode } from 'react'
import { Layers, ChevronLeft, ChevronRight } from 'lucide-react'

// カバー画像の最小形（ItemMedia / ポイント画像どちらも url/thumb_url を持つ）
type CoverImageLike = { id?: string; url?: string; thumb_url?: string } | null | undefined

export interface CoverData {
  name: string
  cover_type: string
  cover_images?: CoverImageLike[]
  cover_image?: CoverImageLike
  cover?: CoverImageLike
}

function imgUrl(m: CoverImageLike): string | null {
  return m?.thumb_url ?? m?.url ?? null
}

function DefaultPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Layers size={24} className="text-muted-foreground/50" />
    </div>
  )
}

// first_card: 先頭画像を表示し、ホバーで左右切替
function FirstImage({ images, name, fallback }: { images: CoverImageLike[]; name: string; fallback: ReactNode }) {
  const [idx, setIdx] = useState(0)
  if (images.length === 0) return <>{fallback}</>

  const safeIdx = idx % images.length
  const url = imgUrl(images[safeIdx])
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
        fallback
      )}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => step(e, -1)}
            aria-label="前の画像"
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 hover:bg-black/60"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => step(e, 1)}
            aria-label="次の画像"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 hover:bg-black/60"
          >
            <ChevronRight size={16} />
          </button>
          <div className="pointer-events-none absolute bottom-1 left-0 right-0 flex justify-center gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
            {images.map((m, i) => (
              <span
                key={m?.id ?? i}
                className={`h-1.5 w-1.5 rounded-full ${i === safeIdx ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// collage: 最大4枚を 2x2 で表示。不足分はプレースホルダで埋める
function Collage({ images, name }: { images: CoverImageLike[]; name: string }) {
  if (images.length === 0) return <DefaultPlaceholder />

  const cells = Array.from({ length: 4 }, (_, i) => images[i] ?? null)
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border">
      {cells.map((m, i) => {
        const url = imgUrl(m)
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
 * エンティティ（デッキ/コレクション/スペース/ビュー）のカバーを、
 * モード（first_card / collage / custom）に応じて描画する汎用コンポーネント。
 * 親が正方形の枠（aspect-square）を与える想定。
 * fallback で画像が無いときの表示（例: スペースの部屋/道アイコン）を差し替えられる。
 */
export function EntityCover({ cover, fallback }: { cover: CoverData; fallback?: ReactNode }) {
  const images = cover.cover_images ?? []
  const type = cover.cover_type ?? 'first_card'
  const placeholder = fallback ?? <DefaultPlaceholder />

  if (type === 'custom') {
    const url = imgUrl(cover.cover_image) ?? imgUrl(cover.cover)
    if (!url) return <>{placeholder}</>
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={cover.name} className="h-full w-full object-cover" loading="lazy" />
    )
  }

  if (type === 'collage') return <Collage images={images} name={cover.name} />

  return <FirstImage images={images} name={cover.name} fallback={placeholder} />
}
