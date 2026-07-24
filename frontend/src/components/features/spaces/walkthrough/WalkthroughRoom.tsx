'use client'

import { type CSSProperties } from 'react'
import { CardImage } from '@/components/ui/card-image'
import { DoorOpen } from 'lucide-react'
import type { WalkthroughStop } from './constants'

// ルーム型のウォークスルー: 部屋の床（間取り）に点を x/y で配置し、順路の線でつなぐ。
// 現在地の点を大きく表示し、activeIndex の変化に合わせて切り替える（部屋を巡るイメージ）。
export function WalkthroughRoom({ stops, activeIndex }: { stops: WalkthroughStop[]; activeIndex: number }) {
  // 点の x/y の外接矩形を求めて内側パディング付きの 0..100(%) へ正規化する。
  const xs = stops.map((s) => s.x ?? 0)
  const ys = stops.map((s) => s.y ?? 0)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const PAD = 12 // %
  const px = (x: number) => PAD + ((x - minX) / spanX) * (100 - 2 * PAD)
  const py = (y: number) => PAD + ((y - minY) / spanY) * (100 - 2 * PAD)

  const line = stops.map((s) => `${px(s.x ?? 0).toFixed(2)},${py(s.y ?? 0).toFixed(2)}`).join(' ')

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6" aria-hidden>
      <div
        className="relative aspect-[4/3] w-full max-w-3xl overflow-hidden rounded-2xl border"
        style={{
          borderColor: 'color-mix(in srgb, var(--palace) 40%, transparent)',
          background:
            'linear-gradient(color-mix(in srgb, var(--palace) 6%, var(--background)), var(--background)), repeating-linear-gradient(0deg, transparent 0 23px, color-mix(in srgb, var(--palace) 10%, transparent) 23px 24px), repeating-linear-gradient(90deg, transparent 0 23px, color-mix(in srgb, var(--palace) 10%, transparent) 23px 24px)',
        }}
      >
        {/* 順路の線 */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {stops.length > 1 && (
            <polyline
              points={line}
              fill="none"
              stroke="var(--palace)"
              strokeOpacity={0.4}
              strokeWidth={0.5}
              strokeDasharray="1.5 1.5"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* 各点マーカー（現在地は大きく） */}
        {stops.map((stop, i) => {
          const active = i === activeIndex
          const pos: CSSProperties = { left: `${px(stop.x ?? 0)}%`, top: `${py(stop.y ?? 0)}%`, zIndex: active ? 10 : 1 }
          return (
            <div key={stop.id} className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500" style={pos}>
              <div
                className={`relative overflow-hidden rounded-lg border-2 bg-card shadow transition-all duration-500 ${
                  active ? 'h-24 w-24' : 'h-11 w-11 opacity-70'
                }`}
                style={{ borderColor: active ? 'var(--palace)' : 'color-mix(in srgb, var(--palace) 50%, white)' }}
              >
                <CardImage
                  src={stop.loci?.url ?? null}
                  blur={stop.loci?.blur}
                  alt={stop.name ?? `ポイント ${i + 1}`}
                  className="h-full w-full"
                  fallback={<DoorOpen size={active ? 22 : 14} style={{ color: 'var(--palace)' }} />}
                />
              </div>
              <span
                className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: 'var(--palace)' }}
              >
                {i + 1}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
