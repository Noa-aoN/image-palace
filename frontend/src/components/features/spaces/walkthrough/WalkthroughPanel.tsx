'use client'

import Link from 'next/link'
import { GalleryHorizontal } from 'lucide-react'
import { CardImage } from '@/components/ui/card-image'
import type { WalkthroughStop } from './constants'

/**
 * 到着時に手前へ来る「結合カード」の HUD。
 * ロキ画像は道の点（背景）で見せるので重複させず、ここでは配置/割当カードを手前に大きく出す。
 * カードが無ければポイント名だけ（ロキは道側にある）。
 */
export function WalkthroughPanel({
  stop,
  index,
  total,
  motion,
  onZoom,
}: {
  stop: WalkthroughStop | null
  index: number
  total: number
  motion: boolean
  onZoom: (url: string, alt: string) => void
}) {
  if (!stop) return null
  const name = stop.name?.trim() || `ポイント ${index + 1}`
  const card = stop.card
  const anim = motion ? 'animate-in fade-in-0 slide-in-from-bottom-4 duration-500' : ''

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-28 ${anim}`}>
      <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border border-border bg-card/85 p-4 text-center shadow-xl backdrop-blur-md">
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {index + 1} / {total}
        </span>
        {card ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => card.url && onZoom(card.url, card.title)}
              aria-label="画像を拡大"
              className="rounded-xl transition-transform hover:scale-[1.02]"
            >
              <CardImage
                src={card.url}
                blur={card.blur}
                alt={card.title}
                className="aspect-square w-44 rounded-xl border border-border"
                fallback={<GalleryHorizontal size={22} className="text-muted-foreground/60" />}
              />
            </button>
            <Link href={`/items/${card.id}`} className="max-w-[11rem] truncate text-sm font-semibold hover:underline">
              {card.title}
            </Link>
          </div>
        ) : null}
        {/* ロキ（場所）の名前。カードがあるときは補足、無いときは主役 */}
        <span className={card ? 'text-xs text-muted-foreground' : 'text-base font-semibold'}>{name}</span>
      </div>
    </div>
  )
}
