'use client'

import { type CSSProperties, type RefObject } from 'react'
import { Loader2, Route } from 'lucide-react'
import { CardImage } from '@/components/ui/card-image'
import { ARRIVAL, SPACING, type WalkthroughStop } from './constants'

// LP の参道と同じ柱の配置（左右対称・360px間隔、mod 2160 で無限折り返し）。
const PILLAR_BASES = [0, 360, 720, 1080, 1440, 1800]
const PILLAR_SIDES = ['l', 'r'] as const

function LociFallback({ stop, index }: { stop: WalkthroughStop; index: number }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-muted-foreground">
      {stop.generating ? <Loader2 size={26} className="animate-spin" /> : <Route size={26} style={{ color: 'var(--palace)' }} />}
      <span className="px-2 text-[11px] leading-tight">{stop.name?.trim() || `ポイント ${index + 1}`}</span>
    </div>
  )
}

/**
 * 一人称の道シーン。地面（road.png トレッドミル）＋両脇の柱＋道の上のロキ点（背景）。
 * すべて --sw-shift(px)（親 .sw-scene に driver が書き込む）から派生して動く。手前のカードは Panel 側。
 */
export function WalkthroughRoad({
  stops,
  stageRef,
  activeIndex,
}: {
  stops: WalkthroughStop[]
  stageRef: RefObject<HTMLDivElement | null>
  activeIndex: number
}) {
  return (
    <div
      ref={stageRef}
      className="sw-scene"
      style={{ '--sw-arrival': ARRIVAL, '--sw-spacing': SPACING } as CSSProperties}
      aria-hidden
    >
      <span className="sw-glow" />
      <div className="sw-plane">
        <div className="sw-road" />
        {PILLAR_BASES.map((base) =>
          PILLAR_SIDES.map((side) => (
            <div
              key={`${base}-${side}`}
              className={`sw-pillar sw-pillar--${side}`}
              style={{ '--sw-pillar-base': base } as CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/road-pillar.png" alt="" decoding="async" loading="lazy" className="sw-pillar-img" />
            </div>
          ))
        )}
        {stops.map((stop, i) => (
          <div key={stop.id} className="sw-point" data-active={i === activeIndex} style={{ '--sw-index': i } as CSSProperties}>
            <div className="sw-point__frame">
              <span className="sw-point__num">{i + 1}</span>
              <CardImage
                src={stop.loci?.url ?? null}
                blur={stop.loci?.blur}
                alt={stop.name ?? `ポイント ${i + 1}`}
                className="h-full w-full"
                fallback={<LociFallback stop={stop} index={i} />}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="sw-haze" />
      <div className="sw-haze sw-haze--bottom" />
    </div>
  )
}
