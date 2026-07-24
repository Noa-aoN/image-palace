'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, Route, GalleryHorizontal } from 'lucide-react'
import { CardImage } from '@/components/ui/card-image'
import type { WalkthroughStop } from './constants'

// ロキ（場所）とカードを対等に並べる1タイル。
function Tile({
  url,
  blur,
  label,
  fallbackIcon,
}: {
  url: string | null
  blur?: string
  label: string
  fallbackIcon: React.ReactNode
}) {
  return (
    <div className="flex w-40 max-w-[38vw] flex-col items-center gap-1.5">
      <CardImage
        src={url}
        blur={blur}
        alt={label}
        className="aspect-square w-full rounded-xl border border-white/15"
        fallback={fallbackIcon}
      />
      <span className="max-w-full truncate text-xs text-white/80">{label}</span>
    </div>
  )
}

/**
 * 点の詳細モーダル。ロキ画像＋（あれば）配置カードを「＋」で対等に並べ、名前を表示。
 * 下部のインジケーター（＜ n/N ＞）とキーボード（←→/Esc）で点を前後移動できる。
 * stops は WalkthroughStop（ロキ＝loci／カード＝card）。スペース詳細・space_map の双方で共用。
 */
export function PointDetailModal({
  stops,
  index,
  onIndex,
  onClose,
}: {
  stops: WalkthroughStop[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const total = stops.length
  const stop = stops[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (index > 0) onIndex(index - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (index < total - 1) onIndex(index + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, total, onIndex, onClose])

  if (typeof document === 'undefined' || !stop) return null

  const name = stop.name?.trim() || `ポイント ${index + 1}`
  const card = stop.card

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex flex-col items-center justify-center gap-5 bg-black/85 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} の詳細`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
      >
        <X size={20} />
      </button>

      {/* ロキ ＋ カード（対等に並べる） */}
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <Tile
          url={stop.loci?.url ?? null}
          blur={stop.loci?.blur}
          label="場所（ロキ）"
          fallbackIcon={<Route size={28} className="text-white/50" />}
        />
        {card && (
          <>
            <span className="select-none text-3xl font-light text-white/70">＋</span>
            <Tile url={card.url} blur={card.blur} label={card.title} fallbackIcon={<GalleryHorizontal size={26} className="text-white/50" />} />
          </>
        )}
      </div>

      <div className="text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white">{name}</h2>
        {card && (
          <Link href={`/items/${card.id}`} className="mt-0.5 inline-block text-xs text-white/70 underline hover:text-white">
            カードを開く
          </Link>
        )}
      </div>

      {/* インジケーター（前後移動） */}
      {total > 1 && (
        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => index > 0 && onIndex(index - 1)}
            disabled={index <= 0}
            aria-label="前のポイント"
            className="rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25 disabled:opacity-30"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-sm tabular-nums text-white/80">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => index < total - 1 && onIndex(index + 1)}
            disabled={index >= total - 1}
            aria-label="次のポイント"
            className="rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25 disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
