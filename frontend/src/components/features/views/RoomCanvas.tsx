'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint, RoomSurface } from '@/types/space'
import { roomSurfaceLabel } from '@/lib/room-surfaces'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const clampScale = (n: number) => Math.min(3, Math.max(0.3, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const palaceTint = (pct: number) => `color-mix(in srgb, var(--palace) ${pct}%, transparent)`
const isWallSurface = (s: RoomSurface) => s.startsWith('wall_')

// 表示エリアは一定（正方キャンバス）。実寸スケール（1m = PCT%）で部屋を中央に描き、余分はブラックアウト。
const MAX_DIM = 10
const PCT = 100 / MAX_DIM
const BLACKOUT = '#17151d'

const PERSPECTIVE = {
  ceiling: 'polygon(0% 0%, 100% 0%, 83% 13%, 17% 13%)',
  floor: 'polygon(0% 100%, 100% 100%, 83% 72%, 17% 72%)',
  leftWall: 'polygon(0% 0%, 17% 13%, 17% 72%, 0% 100%)',
  rightWall: 'polygon(100% 0%, 83% 13%, 83% 72%, 100% 100%)',
}
const FLOOR_PERSP = {
  north: 'polygon(0% 0%, 100% 0%, 82% 18%, 18% 18%)',
  south: 'polygon(0% 100%, 100% 100%, 82% 82%, 18% 82%)',
  west: 'polygon(0% 0%, 18% 18%, 18% 82%, 0% 100%)',
  east: 'polygon(100% 0%, 82% 18%, 82% 82%, 100% 100%)',
}

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
  if (d > 0.5) return null
  const dd = d * 2
  return { left: lerp(lerp(17, 83, h), lerp(0, 100, h), dd), top: lerp(72, 100, dd) }
}
// floorHD の逆（h,d → 床の u,v）
function invFloorHD(facedWall: RoomSurface, h: number, d: number): { u: number; v: number } {
  switch (facedWall) {
    case 'wall_north':
      return { u: h, v: d }
    case 'wall_east':
      return { u: 1 - d, v: h }
    case 'wall_south':
      return { u: 1 - h, v: 1 - d }
    case 'wall_west':
      return { u: d, v: 1 - h }
    default:
      return { u: h, v: d }
  }
}

// ステージ%座標 (0..100) → 面と面内 (u,v)。俯瞰は床＋4壁、壁ビューは配置壁＋床へクロス面移動できる。
function resolveFloorViewUV(sx: number, sy: number): { surface: RoomSurface; u: number; v: number } {
  if (sx >= 18 && sx <= 82 && sy >= 18 && sy <= 82) {
    return { surface: 'floor', u: clamp01((sx - 18) / 64), v: clamp01((sy - 18) / 64) }
  }
  if (sy < sx && sy < 100 - sx) {
    const v = sy / 18
    return { surface: 'wall_north', u: clamp01((sx - 18 * v) / (100 - 36 * v)), v: clamp01(v) }
  }
  if (sy > sx && sy > 100 - sx) {
    const v = (100 - sy) / 18
    return { surface: 'wall_south', u: clamp01((100 - 18 * v - sx) / (100 - 36 * v)), v: clamp01(v) }
  }
  if (sy >= sx && sy <= 100 - sx) {
    const v = sx / 18
    return { surface: 'wall_west', u: clamp01((100 - 18 * v - sy) / (100 - 36 * v)), v: clamp01(v) }
  }
  const v = (100 - sx) / 18
  return { surface: 'wall_east', u: clamp01((sy - 18 * v) / (100 - 36 * v)), v: clamp01(v) }
}
function resolveWallViewUV(activeWall: RoomSurface, sx: number, sy: number): { surface: RoomSurface; u: number; v: number } {
  if (sy > 72) {
    const dd = clamp01((sy - 72) / 28)
    const h = clamp01((sx - 17 + 17 * dd) / (66 + 34 * dd))
    const { u, v } = invFloorHD(activeWall, h, dd / 2)
    return { surface: 'floor', u: clamp01(u), v: clamp01(v) }
  }
  return { surface: activeWall, u: clamp01((sx - 17) / 66), v: clamp01((sy - 13) / 59) }
}

function PointMarker({ point, index }: { point: SpacePoint; index: number }) {
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null
  return (
    <div className="w-12 overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        <span className="absolute left-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white shadow" style={{ backgroundColor: 'var(--palace)' }}>
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

function MiniMarker({ point, index, scale }: { point: SpacePoint; index: number; scale: number }) {
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null
  return (
    <div className="w-8 overflow-hidden rounded border border-border bg-card opacity-90 shadow-sm" style={{ transform: `scale(${scale})` }}>
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        <span className="absolute left-0.5 top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ backgroundColor: 'var(--palace)' }}>
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
  width: number
  depth: number
  height: number
  pointScale: number // 共通倍率
  onMoved: (pointId: string, surface: RoomSurface, u: number, v: number) => void
  onScaled: (pointId: string, scale: number) => void
}

const WALL_KEYS: RoomSurface[] = ['wall_north', 'wall_east', 'wall_south', 'wall_west']

export function RoomCanvas({ spaceId, points, surface, width, depth, height, pointScale, onMoved, onScaled }: RoomCanvasProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null) // ドラッグ中のゴースト位置（ステージ%）
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const facePoints = points.filter((p) => (p.surface ?? 'floor') === surface)
  const wall = isWallSurface(surface)

  const wallWidth = surface === 'wall_north' || surface === 'wall_south' ? width : depth
  const stageW = Math.min(100, (wall ? wallWidth : width) * PCT)
  const stageH = Math.min(100, (wall ? height : depth) * PCT)
  // 床のグリッド（部屋の寸法に連動＝1m 間隔）。backgroundColor と併用（shorthand の上書き回避）。
  const floorGrid = {
    backgroundColor: 'color-mix(in srgb, var(--palace) 10%, #e8c9a0)',
    backgroundImage:
      'linear-gradient(to right, color-mix(in srgb, var(--palace) 26%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--palace) 26%, transparent) 1px, transparent 1px)',
    backgroundSize: `${100 / Math.max(1, width)}% ${100 / Math.max(1, depth)}%`,
  }

  // カーソル → ステージ%座標
  const stagePct = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { sx: 50, sy: 50 }
    return { sx: ((clientX - rect.left) / rect.width) * 100, sy: ((clientY - rect.top) / rect.height) * 100 }
  }
  // ステージ%座標 → 面と面内 (u,v)。配置面の外（壁/床の台形）へ出るとクロス面移動になる。
  const resolveUV = (sx: number, sy: number): { surface: RoomSurface; u: number; v: number } =>
    wall ? resolveWallViewUV(surface, sx, sy) : resolveFloorViewUV(sx, sy)

  // ドラッグ中はゴースト（カーソル追従の大マーカー）だけを動かし、離した位置で面・座標を確定＝滑らか。
  const startDrag = (pointId: string) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragId(pointId)
    const { sx, sy } = stagePct(e.clientX, e.clientY)
    setDragPos({ x: sx, y: sy })
    const onMove = (ev: PointerEvent) => {
      const p = stagePct(ev.clientX, ev.clientY)
      setDragPos({ x: p.sx, y: p.sy })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const p = stagePct(ev.clientX, ev.clientY)
      const r = resolveUV(p.sx, p.sy)
      setDragId(null)
      setDragPos(null)
      onMoved(pointId, r.surface, r.u, r.v)
      updateSpacePoint(spaceId, pointId, { surface: r.surface, u: r.u, v: r.v }).catch(() => {})
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 個別サイズ変更（マーカー角のハンドルをドラッグ）
  const startResize = (point: SpacePoint) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + clamp01(point.u ?? 0.5) * rect.width
    const cy = rect.top + clamp01(point.v ?? 0.5) * rect.height
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1
    const startScale = point.scale ?? 1
    const onMove = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy)
      onScaled(point.id, clampScale(startScale * (dist / startDist)))
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy)
      const next = clampScale(startScale * (dist / startDist))
      onScaled(point.id, next)
      updateSpacePoint(spaceId, point.id, { scale: next }).catch(() => {})
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 背景ドラッグでパン
  const startPan = (e: ReactPointerEvent) => {
    const sx = e.clientX
    const sy = e.clientY
    const start = { ...pan }
    const onMove = (ev: PointerEvent) => setPan({ x: start.x + (ev.clientX - sx), y: start.y + (ev.clientY - sy) })
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ホイールでズーム（ページスクロールを止めるため非パッシブで登録）
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(4, Math.max(0.5, z * (e.deltaY < 0 ? 1.12 : 0.89))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const pointNodes = facePoints.filter((point) => point.id !== dragId).map((point) => (
    <div
      key={point.id}
      className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${clamp01(point.u ?? 0.5) * 100}%`, top: `${clamp01(point.v ?? 0.5) * 100}%` }}
    >
      {/* マーカー全体を掴めるように（onPointerDown をラッパに）。ハンドルは stopPropagation でサイズ変更 */}
      <div
        onPointerDown={startDrag(point.id)}
        role="button"
        tabIndex={0}
        aria-label={`${point.name ?? '未命名'} を配置`}
        className={`relative touch-none select-none ${dragId === point.id ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ transform: `scale(${pointScale * (point.scale ?? 1)})` }}
      >
        <PointMarker point={point} index={points.indexOf(point)} />
        <div
          onPointerDown={startResize(point)}
          className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white shadow"
          style={{ backgroundColor: 'var(--palace)' }}
          title="ドラッグでサイズ変更"
          aria-label="サイズ変更"
        />
      </div>
    </div>
  ))

  const draggedPoint = dragId ? points.find((p) => p.id === dragId) ?? null : null

  const stageContent = wall ? (
    <>
      <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.ceiling, background: 'color-mix(in srgb, var(--palace) 4%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.floor, background: 'color-mix(in srgb, var(--palace) 10%, #e8c9a0)' }} />
      <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.leftWall, background: 'color-mix(in srgb, var(--palace) 11%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: PERSPECTIVE.rightWall, background: 'color-mix(in srgb, var(--palace) 8%, var(--background))' }} />
      <div className="absolute left-1/2 top-[3%] h-[3%] w-[16%] -translate-x-1/2 rounded-full" style={{ background: 'color-mix(in srgb, var(--palace) 6%, white)' }} />
      {points
        .filter((p) => (p.surface ?? 'floor') === 'floor' && p.id !== dragId)
        .map((p) => {
          const pos = floorPointInWall(surface, clamp01(p.u ?? 0.5), clamp01(p.v ?? 0.5))
          if (!pos) return null
          return (
            <div
              key={p.id}
              onPointerDown={startDrag(p.id)}
              role="button"
              tabIndex={0}
              aria-label={`${p.name ?? '未命名'} を配置`}
              className="absolute z-[35] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <MiniMarker point={p} index={points.indexOf(p)} scale={pointScale * (p.scale ?? 1)} />
            </div>
          )
        })}
      <div ref={frameRef} className="absolute z-30 rounded-sm border" style={{ left: '17%', right: '17%', top: '13%', bottom: '28%', background: 'color-mix(in srgb, var(--palace) 6%, var(--background))', borderColor: palaceTint(30) }}>
        {pointNodes}
      </div>
    </>
  ) : (
    <>
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.north, background: 'color-mix(in srgb, var(--palace) 9%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.south, background: 'color-mix(in srgb, var(--palace) 11%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.west, background: 'color-mix(in srgb, var(--palace) 8%, var(--background))' }} />
      <div className="absolute inset-0" style={{ clipPath: FLOOR_PERSP.east, background: 'color-mix(in srgb, var(--palace) 8%, var(--background))' }} />
      <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g fill="none" stroke="var(--palace)" strokeOpacity="0.45" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
          <line x1="0" y1="0" x2="18" y2="18" />
          <line x1="100" y1="0" x2="82" y2="18" />
          <line x1="100" y1="100" x2="82" y2="82" />
          <line x1="0" y1="100" x2="18" y2="82" />
        </g>
      </svg>
      <div className="absolute bottom-0 left-1/2 h-[3%] w-[12%] -translate-x-1/2" style={{ backgroundColor: BLACKOUT }} />
      {WALL_KEYS.flatMap((ws) =>
        points
          .filter((p) => p.surface === ws && p.id !== dragId)
          .map((p) => {
            const { left, top } = wallPointInFloor(ws, clamp01(p.u ?? 0.5), clamp01(p.v ?? 0.5))
            return (
              <div
                key={p.id}
                onPointerDown={startDrag(p.id)}
                role="button"
                tabIndex={0}
                aria-label={`${p.name ?? '未命名'} を配置`}
                className="absolute z-[35] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <MiniMarker point={p} index={points.indexOf(p)} scale={pointScale * (p.scale ?? 1)} />
              </div>
            )
          })
      )}
      <div ref={frameRef} className="absolute z-30 rounded-sm border" style={{ left: '18%', right: '18%', top: '18%', bottom: '18%', borderColor: palaceTint(30), ...floorGrid }}>
        {pointNodes}
      </div>
    </>
  )

  return (
    <div ref={outerRef} className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-xl border-2" style={{ borderColor: palaceTint(40), backgroundColor: BLACKOUT }}>
      {/* ズーム/パン層。背景ドラッグでパン、ホイールでズーム */}
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }} onPointerDown={startPan}>
        <div ref={stageRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `${stageW}%`, height: `${stageH}%` }}>
          {stageContent}
          {/* ドラッグ中のゴースト（カーソル追従。離すと面・座標を確定） */}
          {draggedPoint && dragPos && (
            <div className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-1/2" style={{ left: `${dragPos.x}%`, top: `${dragPos.y}%` }}>
              <div style={{ transform: `scale(${pointScale * (draggedPoint.scale ?? 1)})` }}>
                <PointMarker point={draggedPoint} index={points.indexOf(draggedPoint)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <span className="pointer-events-none absolute left-2 top-2 z-40 rounded-md bg-background/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {roomSurfaceLabel(surface)}
      </span>

      {/* ズーム操作 */}
      <div className="absolute bottom-2 right-2 z-40 flex flex-col gap-1">
        <button onClick={() => setZoom((z) => Math.min(4, z * 1.2))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground hover:text-foreground" aria-label="ズームイン">
          <ZoomIn size={15} />
        </button>
        <button onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground hover:text-foreground" aria-label="ズームアウト">
          <ZoomOut size={15} />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground hover:text-foreground" aria-label="リセット">
          <Maximize size={14} />
        </button>
      </div>

    </div>
  )
}
