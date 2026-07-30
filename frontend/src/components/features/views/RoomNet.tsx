'use client'

import type { SpacePoint, RoomSurface } from '@/types/space'
import { roomSurfaceShort } from '@/lib/room-surfaces'
import { gridStroke, shadeSurface, type RoomStyle } from '@/lib/room-style'
import { pointImageUrl } from '@/lib/space-points'

// 部屋を開いた形（展開図）。床を中心に、4壁と天井を配置する。
const NET: (RoomSurface | null)[] = [
  null, 'wall_north', null,
  'wall_west', 'floor', 'wall_east',
  null, 'wall_south', null,
  null, 'ceiling', null,
]

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

type Props = {
  points: SpacePoint[]
  style: RoomStyle
  width: number
  depth: number
  /** タイルを押したときにその面へ移動する */
  onSelect?: (surface: RoomSurface) => void
  activeSurface?: RoomSurface
}

/**
 * 全面を一度に見渡す展開図。
 *
 * 面ごとの配置ビュー（RoomCanvas）は1面ずつしか見えないため、
 * 「どの面に何が置いてあるか」を俯瞰するための補助ビュー。編集はしない。
 */
export function RoomNet({ points, style, width, depth, onSelect, activeSurface }: Props) {
  return (
    <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-1.5">
      {NET.map((surface, idx) => {
        if (!surface) return <div key={idx} />
        const facePoints = points.filter((p) => (p.surface ?? 'floor') === surface)
        const isFloor = surface === 'floor'
        const bg = isFloor ? style.floor : surface === 'ceiling' ? style.ceiling : shadeSurface(style.wall, -8)
        const active = activeSurface === surface
        // 床だけ 1m グリッドを敷く（配置ビューと同じ見え方に揃える）
        const grid = isFloor
          ? {
              backgroundImage: `linear-gradient(to right, ${gridStroke(style)} 1px, transparent 1px), linear-gradient(to bottom, ${gridStroke(style)} 1px, transparent 1px)`,
              backgroundSize: `${100 / Math.max(1, width)}% ${100 / Math.max(1, depth)}%`,
            }
          : {}

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect?.(surface)}
            aria-label={`${roomSurfaceShort(surface)}の面を見る`}
            className="relative aspect-square w-full overflow-hidden rounded-md border transition-shadow hover:shadow-sm"
            style={{
              backgroundColor: bg,
              borderColor: active ? style.edge : `color-mix(in srgb, ${style.edge} 35%, transparent)`,
              boxShadow: active ? `0 0 0 2px ${style.edge}` : undefined,
              ...grid,
            }}
          >
            <span className="absolute left-1 top-1 z-10 rounded bg-background/70 px-1 text-[9px] font-medium text-muted-foreground">
              {roomSurfaceShort(surface)}
              {facePoints.length > 0 && <span className="ml-0.5 opacity-70">{facePoints.length}</span>}
            </span>
            {facePoints.map((p) => {
              const url = pointImageUrl(p)
              return (
                <span
                  key={p.id}
                  className="absolute overflow-hidden rounded-sm border border-black/15 bg-card"
                  style={{
                    left: `${clamp01(p.u ?? 0.5) * 100}%`,
                    top: `${clamp01(p.v ?? 0.5) * 100}%`,
                    width: '22%',
                    height: '22%',
                    transform: `translate(-50%, -50%) rotate(${p.rotation_z ?? 0}deg)`,
                  }}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} crossOrigin="anonymous" alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">
                      {points.indexOf(p) + 1}
                    </span>
                  )}
                </span>
              )
            })}
          </button>
        )
      })}
    </div>
  )
}
