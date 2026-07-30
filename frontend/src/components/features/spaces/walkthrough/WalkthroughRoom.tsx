'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { CardImage } from '@/components/ui/card-image'
import { DoorOpen } from 'lucide-react'
import type { WalkthroughStop } from './constants'
import type { RoomSurface } from '@/types/space'
import { ROOM_SURFACES, PLACEABLE_SURFACES } from '@/lib/room-surfaces'

// ルーム型ウォークスルー（多面）: 記憶の部屋を「床（俯瞰）・天井・4壁」の面ごとに切り替えて巡る。
// 各点は面内の正規化座標 (u,v)∈[0,1] に配置される（stop.x=u, stop.y=v で受け取る）。
// 現在地の面へ自動追従しつつ、上部トグルで任意の面や「展開図（全面一覧）」に切り替えられる。
const WALL = 4
const DOOR = { x: 50, w: 16 } // 床の下辺中央の入口開口
const PAD = 10 // 点を面内に収める余白(%)（マーカーが枠で切れないように）

type ViewKey = RoomSurface | 'unfolded'

const surfaceOf = (s: WalkthroughStop): RoomSurface => s.surface ?? 'floor'
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const uOf = (s: WalkthroughStop) => clamp01(s.x ?? 0.5)
const vOf = (s: WalkthroughStop) => clamp01(s.y ?? 0.5)
const pct = (t: number) => PAD + t * (100 - 2 * PAD)
const shortLabel = (surface: RoomSurface) => ROOM_SURFACES.find((s) => s.key === surface)?.short ?? surface

// 部屋の1面を境界のある正方形として描き、その面の点を (u,v) で配置する。
// variant='lg' は単面ビュー（大きく）、'sm' は展開図のセル（小さく）。
function FaceBoard({
  surface,
  stops,
  activeIndex,
  variant,
}: {
  surface: RoomSurface
  stops: WalkthroughStop[]
  activeIndex: number
  variant: 'lg' | 'sm'
}) {
  const isFloor = surface === 'floor'
  const big = variant === 'lg'
  const faceStops = stops.map((s, i) => ({ s, i })).filter(({ s }) => surfaceOf(s) === surface)

  // 順路（この面の点を序数順に結ぶ。床は入口→各点）
  const pts = faceStops.map(({ s }) => `${pct(uOf(s)).toFixed(1)},${pct(vOf(s)).toFixed(1)}`)
  const route = isFloor ? [`${DOOR.x},${100 - WALL}`, ...pts].join(' ') : pts.join(' ')
  const showRoute = isFloor ? pts.length > 0 : pts.length > 1

  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-xl border-2"
      style={{
        borderColor: 'color-mix(in srgb, var(--palace) 40%, transparent)',
        background: 'linear-gradient(color-mix(in srgb, var(--palace) 6%, var(--background)), var(--background))',
      }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {isFloor ? (
          <>
            <rect
              x={WALL}
              y={WALL}
              width={100 - 2 * WALL}
              height={100 - 2 * WALL}
              fill="color-mix(in srgb, var(--palace) 7%, var(--background))"
            />
            <path
              d={`M${WALL},${100 - WALL} L${WALL},${WALL} L${100 - WALL},${WALL} L${100 - WALL},${100 - WALL} M${WALL},${100 - WALL} L${DOOR.x - DOOR.w / 2},${100 - WALL} M${DOOR.x + DOOR.w / 2},${100 - WALL} L${100 - WALL},${100 - WALL}`}
              fill="none"
              stroke="color-mix(in srgb, var(--palace) 80%, white)"
              strokeWidth={1.4}
              strokeLinecap="square"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <rect
            x={WALL}
            y={WALL}
            width={100 - 2 * WALL}
            height={100 - 2 * WALL}
            fill="none"
            stroke="color-mix(in srgb, var(--palace) 55%, white)"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {showRoute && (
          <polyline
            points={route}
            fill="none"
            stroke="var(--palace)"
            strokeOpacity={0.45}
            strokeWidth={0.6}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {isFloor && big && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground"
          style={{ left: `${DOOR.x}%`, top: `${100 - WALL}%` }}
        >
          入口
        </div>
      )}
      {!big && (
        <span className="absolute left-1 top-1 z-10 rounded bg-background/70 px-1 text-[9px] font-medium text-muted-foreground">
          {shortLabel(surface)}
        </span>
      )}

      {faceStops.map(({ s, i }) => {
        const active = i === activeIndex
        const pos: CSSProperties = { left: `${pct(uOf(s))}%`, top: `${pct(vOf(s))}%`, zIndex: active ? 10 : 1 }
        const size = big
          ? active
            ? 'h-24 w-24'
            : 'h-11 w-11 opacity-75'
          : active
            ? 'h-7 w-7'
            : 'h-4 w-4 opacity-70'
        return (
          <div key={s.id} className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500" style={pos}>
            <div
              className={`relative overflow-hidden rounded-lg border-2 bg-card shadow transition-all duration-500 ${size} ${
                active ? 'ring-2 ring-[var(--palace)]/40' : ''
              }`}
              style={{ borderColor: active ? 'var(--palace)' : 'color-mix(in srgb, var(--palace) 45%, white)' }}
            >
              <CardImage
                src={s.loci?.url ?? null}
                blur={s.loci?.blur}
                alt={s.name ?? ''}
                className="h-full w-full"
                fallback={<DoorOpen size={big ? (active ? 22 : 14) : 10} style={{ color: 'var(--palace)' }} />}
              />
            </div>
            {big && (
              <span
                className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white shadow"
                style={{ backgroundColor: 'var(--palace)' }}
              >
                {i + 1}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// 展開図（キューブのネット）: 全6面を平面に並べて一望する。現在地の点はどの面でもハイライトされる。
const NET_LAYOUT: (RoomSurface | null)[] = [
  null, 'wall_north', null,
  'wall_west', 'floor', 'wall_east',
  null, 'wall_south', null,
  null, 'ceiling', null,
]

function UnfoldedNet({ stops, activeIndex }: { stops: WalkthroughStop[]; activeIndex: number }) {
  return (
    <div className="grid w-full max-w-[440px] grid-cols-3 gap-1.5">
      {NET_LAYOUT.map((surface, idx) =>
        surface ? (
          <FaceBoard key={idx} surface={surface} stops={stops} activeIndex={activeIndex} variant="sm" />
        ) : (
          <div key={idx} />
        )
      )}
    </div>
  )
}

export function WalkthroughRoom({ stops, activeIndex }: { stops: WalkthroughStop[]; activeIndex: number }) {
  const active = stops[activeIndex]
  const activeSurface: RoomSurface = active ? surfaceOf(active) : 'floor'
  const [view, setView] = useState<ViewKey>(activeSurface)

  // 現在地の面が変わったらその面へ自動追従（手動で選んだ面は面が変わるまで保持）。
  useEffect(() => {
    setView(activeSurface)
  }, [activeSurface])

  const facesWithPoints = new Set(stops.map(surfaceOf))

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
      {/* 面切替トグル（俯瞰/4壁/天井/展開図）。現在地の面には印を付ける */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {PLACEABLE_SURFACES.map((s) => {
          const selected = view === s.key
          const hasPoints = facesWithPoints.has(s.key)
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setView(s.key)}
              aria-pressed={selected}
              className={`relative rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                selected
                  ? 'border-[var(--palace)] bg-[var(--palace)]/15 text-foreground'
                  : hasPoints
                    ? 'border-border text-muted-foreground hover:bg-muted'
                    : 'border-border/50 text-muted-foreground/50'
              }`}
            >
              {s.short}
              {s.key === activeSurface && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--palace)' }} />
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setView('unfolded')}
          aria-pressed={view === 'unfolded'}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            view === 'unfolded'
              ? 'border-[var(--palace)] bg-[var(--palace)]/15 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          展開図
        </button>
      </div>

      <div className="flex w-full flex-1 items-center justify-center" aria-hidden>
        {view === 'unfolded' ? (
          <UnfoldedNet stops={stops} activeIndex={activeIndex} />
        ) : (
          <div className="w-full max-w-[520px]">
            <FaceBoard surface={view} stops={stops} activeIndex={activeIndex} variant="lg" />
          </div>
        )}
      </div>
    </div>
  )
}
