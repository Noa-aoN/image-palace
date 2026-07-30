'use client'

import { type CSSProperties } from 'react'
import { CardImage } from '@/components/ui/card-image'
import { DoorOpen } from 'lucide-react'
import type { WalkthroughStop } from './constants'
import type { RoomSurface } from '@/types/space'
import { ROOM_SURFACES } from '@/lib/room-surfaces'
import { type RoomStyle } from '@/lib/room-style'
import type { SpacePoint } from '@/types/space'
import { RoomCanvas } from '@/components/features/views/RoomCanvas'

// ルーム型ウォークスルー（多面）: 記憶の部屋を「床（俯瞰）・天井・4壁」の面ごとに切り替えて巡る。
// 各点は面内の正規化座標 (u,v)∈[0,1] に配置される（stop.x=u, stop.y=v で受け取る）。
// 現在地の面へ自動追従しつつ、上部トグルで任意の面や「展開図（全面一覧）」に切り替えられる。
const WALL = 4
const DOOR = { x: 50, w: 16 } // 床の下辺中央の入口開口
const PAD = 10 // 点を面内に収める余白(%)（マーカーが枠で切れないように）

const surfaceOf = (s: WalkthroughStop): RoomSurface => s.surface ?? 'floor'

/**
 * 2D ウォークスルーで映す面。基本は東西南北の壁のいずれか。
 *
 * 壁ビューは床の手前半分も一緒に映るため、床の点は「いちばん近い壁」から見れば収まる。
 * 俯瞰（床）や天井へ切り替わると部屋を歩いている感じが途切れるので、壁に寄せる。
 */
function wallViewFor(stop: WalkthroughStop): RoomSurface {
  const surface = surfaceOf(stop)
  if (surface.startsWith('wall_')) return surface

  const u = clamp01(stop.x ?? 0.5)
  const v = clamp01(stop.y ?? 0.5)
  // 各壁からの距離（RoomCanvas の floorHD と同じ対応）
  const byDistance: [RoomSurface, number][] = [
    ['wall_north', v],
    ['wall_south', 1 - v],
    ['wall_west', u],
    ['wall_east', 1 - u],
  ]
  return byDistance.sort((a, b) => a[1] - b[1])[0][0]
}
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
  style,
}: {
  surface: RoomSurface
  stops: WalkthroughStop[]
  activeIndex: number
  variant: 'lg' | 'sm'
  style: RoomStyle
}) {
  const isFloor = surface === 'floor'
  // 面の色は 2D/3D と同じ部屋スタイルから引く
  const faceFill = isFloor ? style.floor : surface === 'ceiling' ? style.ceiling : style.wall
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
        borderColor: `color-mix(in srgb, ${style.edge} 40%, transparent)`,
        background: `linear-gradient(color-mix(in srgb, ${style.edge} 6%, var(--background)), var(--background))`,
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
              fill={faceFill}
            />
            <path
              d={`M${WALL},${100 - WALL} L${WALL},${WALL} L${100 - WALL},${WALL} L${100 - WALL},${100 - WALL} M${WALL},${100 - WALL} L${DOOR.x - DOOR.w / 2},${100 - WALL} M${DOOR.x + DOOR.w / 2},${100 - WALL} L${100 - WALL},${100 - WALL}`}
              fill="none"
              stroke={style.edge}
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
            fill={faceFill}
            stroke={style.edge}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {showRoute && (
          <polyline
            points={route}
            fill="none"
            stroke={style.edge}
            strokeOpacity={0.55}
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
export function WalkthroughRoom({
  stops,
  activeIndex,
  style,
  spaceId,
  points,
  dims,
}: {
  stops: WalkthroughStop[]
  activeIndex: number
  style: RoomStyle
  // 実ポイントが渡されたら、配置ビューと同じ描画（RoomCanvas）をそのまま閲覧用に使う。
  // 渡されない経路（スペースマップのウォークスルー）は従来の簡易面パネルにフォールバックする。
  spaceId?: string
  points?: SpacePoint[]
  dims?: { width: number; height: number; depth: number }
}) {
  const active = stops[activeIndex]
  const activeSurface: RoomSurface = active ? wallViewFor(active) : 'wall_north'
  // ウォークスルーは順路に従うだけ。面の手動切替や展開図は配置ビュー側の役割
  const view = activeSurface

  return (
    <div className="absolute inset-0">
      <div className="h-full w-full" aria-hidden>
        {points && spaceId && dims ? (
          <div className="h-full w-full">
            <RoomCanvas
              spaceId={spaceId}
              points={points}
              surface={view}
              width={dims.width}
              depth={dims.depth}
              height={dims.height}
              pointScale={1}
              style={style}
              readOnly
              fullBleed
              activePointId={stops[activeIndex]?.id ?? null}
            />
          </div>
        ) : (
          <div className="mx-auto flex h-full w-full max-w-[520px] items-center justify-center p-6">
            <FaceBoard surface={view} stops={stops} activeIndex={activeIndex} variant="lg" style={style} />
          </div>
        )}
      </div>
    </div>
  )
}
