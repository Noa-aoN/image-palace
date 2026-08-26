'use client'

import Link from 'next/link'
import { GalleryHorizontal, Route } from 'lucide-react'
import { CardImage } from '@/components/ui/card-image'
import type { WalkthroughStop } from './constants'

/**
 * 到着時の HUD。
 * - space_map（ロキ＋配置カードの両方あり）: 背景（ロキ）とカードを「＋」で並べて同時に表示する。
 * - スペースのロード（1画像のみ・card=null）: ロキは道側で見せるので、ここは名前だけ。
 * key={index}（呼び出し側）で点が変わるたび再マウントし、フェード/スライドインを再生する。
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
  const loci = stop.loci
  const card = stop.card
  const pair = !!(loci && card)
  const anim = motion ? 'animate-in fade-in-0 slide-in-from-bottom-4 duration-500' : ''

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-28 ${anim}`}>
      {/* 部屋の景色を隠しすぎないよう、小さめ＋透け感を持たせる */}
      <div className={`pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl border border-border/70 bg-card/65 p-3 text-center shadow-lg backdrop-blur-md ${pair ? 'w-full max-w-sm' : 'w-full max-w-[15rem]'}`}>
        <span className="text-2xs font-medium tabular-nums text-muted-foreground">
          {index + 1} / {total}
        </span>

        {pair ? (
          // 背景（ロキ）＋カードを同時表示
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => loci!.url && onZoom(loci!.url, `${name}（場所）`)} aria-label="場所を拡大" className="rounded-xl transition-transform hover:scale-[1.02]">
              <CardImage
                src={loci!.url}
                blur={loci!.blur}
                alt={`${name}（場所）`}
                className="aspect-square w-24 rounded-xl border border-border"
                fallback={<Route size={22} className="text-muted-foreground/60" />}
              />
            </button>
            <span className="select-none text-2xl font-light text-muted-foreground">＋</span>
            <button type="button" onClick={() => card!.url && onZoom(card!.url, card!.title)} aria-label="カードを拡大" className="rounded-xl transition-transform hover:scale-[1.02]">
              <CardImage
                src={card!.url}
                blur={card!.blur}
                alt={card!.title}
                className="aspect-square w-24 rounded-xl border border-border"
                fallback={<GalleryHorizontal size={22} className="text-muted-foreground/60" />}
              />
            </button>
          </div>
        ) : card ? (
          <button type="button" onClick={() => card.url && onZoom(card.url, card.title)} aria-label="画像を拡大" className="rounded-xl transition-transform hover:scale-[1.02]">
            <CardImage
              src={card.url}
              blur={card.blur}
              alt={card.title}
              className="aspect-square w-44 rounded-xl border border-border"
              fallback={<GalleryHorizontal size={22} className="text-muted-foreground/60" />}
            />
          </button>
        ) : null}

        <div>
          <span className={pair || card ? 'text-xs text-muted-foreground' : 'text-base font-semibold'}>{name}</span>
          {card && (
            <Link href={`/items/${card.id}`} className="ml-1 text-xs text-[var(--palace)] underline">
              {card.title}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
