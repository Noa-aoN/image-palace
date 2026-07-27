'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint, RoomSurface } from '@/types/space'
import { roomSurfaceLabel } from '@/lib/room-surfaces'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const palaceTint = (pct: number) => `color-mix(in srgb, var(--palace) ${pct}%, transparent)`
const isWallSurface = (s: RoomSurface) => s.startsWith('wall_')

// 壁ビュー（脱出ゲーム風・一点透視）の周囲台形
const PERSPECTIVE = {
  ceiling: 'polygon(0% 0%, 100% 0%, 83% 13%, 17% 13%)',
  floor: 'polygon(0% 100%, 100% 100%, 83% 72%, 17% 72%)',
  leftWall: 'polygon(0% 0%, 17% 13%, 17% 72%, 0% 100%)',
  rightWall: 'polygon(100% 0%, 83% 13%, 83% 72%, 100% 100%)',
}
// 俯瞰（箱を上から覗く）の周囲台形
const FLOOR_PERSP = {
  north: 'polygon(0% 0%, 100% 0%, 82% 18%, 18% 18%)',
  south: 'polygon(0% 100%, 100% 100%, 82% 82%, 18% 82%)',
  west: 'polygon(0% 0%, 18% 18%, 18% 82%, 0% 100%)',
  east: 'polygon(100% 0%, 82% 18%, 82% 82%, 100% 100%)',
}
const FLOOR_GRID =
  'repeating-linear-gradient(0deg, transparent 0 23px, color-mix(in srgb, var(--palace) 9%, transparent) 23px 24px), repeating-linear-gradient(90deg, transparent 0 23px, color-mix(in srgb, var(--palace) 9%, transparent) 23px 24px)'

// 俯瞰時、壁の点をその壁台形へ写す（外辺=天井/v0、内辺=床/v1、u=oL→oR）。
type Corners = { oL: [number, number]; oR: [number, number]; iL: [number, number]; iR: [number, number] }
const FLOOR_WALL_CORNERS: Record<'wall_north' | 'wall_south' | 'wall_east' | 'wall_west', Corners> = {
  wall_north: { oL: [0, 0], oR: [100, 0], iL: [18, 18], iR: [82, 18] },
  wall_south: { oL: [100, 100], oR: [0, 100], iL: [82, 82], iR: [18, 82] },
  wall_east: { oL: [100, 0], oR: [100, 100], iL: [82, 18], iR: [82, 82] },
  wall_west: { oL: [0, 100], oR: [0, 0], iL: [18, 82], iR: [18, 18] },
}
function wallPointInFloor(wall: RoomSurface, u: number, v: number): { left: number; top: number } {
  const c = FLOOR_WALL_CORNERS[wall as keyof typeof FLOOR_WALL_CORNERS]
  const topX = lerp(c.oL[0], c.oR[0], u)
  const topY = lerp(c.oL[1], c.oR[1], u)
  const botX = lerp(c.iL[0], c.iR[0], u)
  const botY = lerp(c.iL[1], c.iR[1], u)
  return { left: lerp(topX, botX, v), top: lerp(topY, botY, v) }
}

// 壁ビュー時、床の点を床台形へ写す。向いている壁で床の (u,v) の写像が回転する。
function floorHD(facedWall: RoomSurface, u: number, v: number): { h: number; d: number } {
  switch (facedWall) {
    case 'wall_north':
      return { h: u, d: v }
    case 'wall_east':
      return { h: v, d: 1 - u }
    case 'wall_south':
      return { h: 1 - u, d: 1 - v }
    case 'wall_west':
      return { h: 1 - v, d: u }
    default:
      return { h: u, d: v }
  }
}
function floorPointInWall(facedWall: RoomSurface, u: number, v: number): { left: number; top: number } | null {
  const { h, d } = floorHD(facedWall, u, v)
  if (d > 0.5) return null // 手前半分は表示しない（奥＝壁側の半分までを床台形に写す）
  const dd = d * 2
  const topX = lerp(17, 83, h) // 奥(床の遠辺, y=72)
  const botX = lerp(0, 100, h) // 手前(床の中央, y=100)
  return { left: lerp(topX, botX, dd), top: lerp(72, 100, dd) }
}

// 配置面の点マーカー（loci 画像 + ポイント番号）。ドラッグ可。
function PointMarker({ point, index }: { point: SpacePoint; index: number }) {
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null
  return (
    <div className="w-20 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        <span
          className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow"
          style={{ backgroundColor: 'var(--palace)' }}
        >
          {index + 1}
        </span>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={point.name ?? ''} className="h-full w-full object-cover" draggable={false} loading="lazy" />
        ) : (
          <span className="px-1 text-center text-[9px] text-muted-foreground">{point.name || '未命名'}</span>
        )}
        {point.item && <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" title="カード配置済み" />}
      </div>
    </div>
  )
}

// 他面の点を文脈表示する小マーカー（読み取り専用・小さめ）。
function MiniMarker({ point, index }: { point: SpacePoint; index: number }) {
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null
  return (
    <div className="w-11 overflow-hidden rounded-md border border-border bg-card opacity-90 shadow-sm">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        <span
          className="absolute left-0.5 top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: 'var(--palace)' }}
        >
          {index + 1}
        </span>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={point.name ?? ''} className="h-full w-full object-cover" draggable={false} loading="lazy" />
        ) : null}
      </div>
    </div>
  )
}

type RoomCanvasProps = {
  spaceId: string
  points: SpacePoint[]
  surface: RoomSurface
  onMoved: (pointId: string, u: number, v: number) => void
}

const WALL_KEYS: RoomSurface[] = ['wall_north', 'wall_east', 'wall_south', 'wall_west']

export function RoomCanvas({ spaceId, points, surface, onMoved }: RoomCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const facePoints = points.filter((p) => (p.surface ?? 'floor') === surface)
  const wall = isWallSurface(surface)

  const uvFromClient = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { u: 0.5, v: 0.5 }
    return { u: clamp01((clientX - rect.left) / rect.width), v: clamp01((clientY - rect.top) / rect.height) }
  }

  const startDrag = (pointId: string) => (e: ReactPointerEvent) => {
    e.preventDefault()
    setDragId(pointId)
    const onMove = (ev: PointerEvent) => {
      const { u, v } = uvFromClient(ev.clientX, ev.clientY)
      onMoved(pointId, u, v)
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragId(null)
      const { u, v } = uvFromClient(ev.clientX, ev.clientY)
      onMoved(pointId, u, v)
      updateSpacePoint(spaceId, pointId, { surface, u, v }).catch(() => {})
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 配置面（frameRef）内の点（ドラッグ可）
  const pointNodes = facePoints.map((point) => (
    <div
      key={point.id}
      onPointerDown={startDrag(point.id)}
      role="button"
      tabIndex={0}
      aria-label={`${point.name ?? '未命名'} を配置`}
      className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none ${dragId === point.id ? 'z-30 cursor-grabbing' : 'z-20 cursor-grab'}`}
      style={{ left: `${clamp01(point.u ?? 0.5) * 100}%`, top: `${clamp01(point.v ?? 0.5) * 100}%` }}
    >
      <PointMarker point={point} index={points.indexOf(point)} />
    </div>
  ))

  const emptyHint = facePoints.length === 0 && (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6">
      <p className="rounded-md bg-background/70 px-2 py-1 text-center text-sm text-muted-foreground">
        この面にはまだ点がありません。下の一覧で点の「面」をこの面にすると置けます。
      </p>
    </div>
  )

  const label = (
    <span className="pointer-events-none absolute left-2 top-2 z-40 rounded-md bg-background/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {roomSurfaceLabel(surface)}
    </span>
  )

  // 壁: 一点透視の部屋（配置面＝遠壁、床台形に床の点も文脈表示）
  if (wall) {
    const floorPoints = points.filter((p) => (p.surface ?? 'floor') === 'floor')
    return (
      <div
        className="relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-xl border-2"
        style={{ borderColor: palaceTint(40), backgroundColor: 'var(--ivory-dark)' }}
      >
        <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.ceiling, background: 'color-mix(in srgb, var(--palace) 4%, var(--background))' }} />
        <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.floor, background: 'color-mix(in srgb, var(--palace) 10%, #e8c9a0)' }} />
        <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.leftWall, background: 'color-mix(in srgb, var(--palace) 11%, var(--background))' }} />
        <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.rightWall, background: 'color-mix(in srgb, var(--palace) 8%, var(--background))' }} />
        <div className="absolute left-1/2 top-[3%] h-[3%] w-[16%] -translate-x-1/2 rounded-full" style={{ background: 'color-mix(in srgb, var(--palace) 6%, white)' }} />

        {/* 床の点（文脈・読み取り専用。奥＝壁側の半分まで） */}
        {floorPoints.map((p) => {
          const pos = floorPointInWall(surface, clamp01(p.u ?? 0.5), clamp01(p.v ?? 0.5))
          if (!pos) return null
          return (
            <div key={p.id} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
              <MiniMarker point={p} index={points.indexOf(p)} />
            </div>
          )
        })}

        {/* 遠壁＝配置面（点は枠に埋まらないよう overflow を切る） */}
        <div
          ref={frameRef}
          className="absolute z-20 rounded-sm border"
          style={{ left: '17%', right: '17%', top: '13%', bottom: '28%', background: 'color-mix(in srgb, var(--palace) 6%, var(--background))', borderColor: palaceTint(30) }}
        >
          {pointNodes}
        </div>

        {label}
        {emptyHint}
      </div>
    )
  }

  // 床（俯瞰）: 箱を上から覗く。中央＝床（配置面）、四方の台形＝壁（壁の点も文脈表示）
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-xl border-2"
      style={{ borderColor: palaceTint(40), backgroundColor: 'var(--ivory-dark)' }}
    >
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.north, background: 'color-mix(in srgb, var(--palace) 9%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.south, background: 'color-mix(in srgb, var(--palace) 11%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.west, background: 'color-mix(in srgb, var(--palace) 8%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.east, background: 'color-mix(in srgb, var(--palace) 8%, var(--background))' }} />

      {/* 壁の境目（四隅への稜線） */}
      <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g fill="none" stroke="var(--palace)" strokeOpacity="0.45" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
          <line x1="0" y1="0" x2="18" y2="18" />
          <line x1="100" y1="0" x2="82" y2="18" />
          <line x1="100" y1="100" x2="82" y2="82" />
          <line x1="0" y1="100" x2="18" y2="82" />
        </g>
      </svg>

      {/* 入口（南壁の中央） */}
      <div className="absolute bottom-0 left-1/2 h-[3%] w-[12%] -translate-x-1/2" style={{ backgroundColor: 'var(--ivory-dark)' }} />

      {/* 各壁の点（文脈・読み取り専用） */}
      {WALL_KEYS.flatMap((ws) =>
        points
          .filter((p) => p.surface === ws)
          .map((p) => {
            const { left, top } = wallPointInFloor(ws, clamp01(p.u ?? 0.5), clamp01(p.v ?? 0.5))
            return (
              <div key={p.id} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
                <MiniMarker point={p} index={points.indexOf(p)} />
              </div>
            )
          })
      )}

      {/* 中央＝床（配置面。点は枠に埋まらないよう overflow を切る） */}
      <div
        ref={frameRef}
        className="absolute z-20 rounded-sm border"
        style={{ left: '18%', right: '18%', top: '18%', bottom: '18%', background: 'color-mix(in srgb, var(--palace) 10%, #e8c9a0)', borderColor: palaceTint(30), backgroundImage: FLOOR_GRID }}
      >
        {pointNodes}
      </div>

      {label}
      {emptyHint}
    </div>
  )
}
