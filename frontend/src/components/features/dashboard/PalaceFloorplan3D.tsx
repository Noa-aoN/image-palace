'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  ROOMS,
  WALL_SEGMENTS,
  PORCH_SEGMENTS,
  PARTITION_SEGMENTS,
  STYLOBATE,
  BUILDING_FLOOR,
  PORCH_FLOOR,
  COURTYARD,
  COLUMNS,
  HEARTH,
  BACK_EXIT,
  type Room,
  type Segment,
} from './floorplan-geometry'

// 正面のまま立ち上げる 2.5D 投影（平面は 45° 回さない＝2D と同じ向きのまま）。
// 奥行き（平面の y）は KY で圧縮し、高さ z は画面上方向へ持ち上げる。
const KY = 0.72
const OY = 30
// 建物は 2D と同じ枠（360×158）。道は 2D と同じ 128px の帯に、続きの投影で描く。
const VB = { w: 360, h: 158 }
const ROAD_VB = { y: 150, h: 62 }

const WALL_H = 16 // 壁は低く抑え、上端をぼかして溶かす
const WALL_T = 4 // 壁の厚み（2D の線の太さと同じ）
const COLUMN_H = 22

// 道（玄関から手前へ）。平面座標のまま、建物の下へ続ける。
// 玄関（ポルチコ前・y=150）から道までを階段で繋ぐ。段は手前へ下りながら幅を絞る。
const STAIRS = { y: 150, h: 18, steps: 4, topW: 144, bottomW: 92, z: 6 }
const ROAD = { x: 140, y: 168, w: 80, h: 66 }
const ROAD_COLUMNS: [number, number][] = [
  [136, 180], [224, 180],
  [136, 205], [224, 205],
  [136, 230], [224, 230],
]

// 道は手前ほど広がる（建物の奥行き圧縮に馴染む角度）。
const ROAD_FLARE = 0.55

type P = { x: number; y: number }

const project = (x: number, y: number, z = 0): P => ({ x, y: y * KY - z + OY })

// 道の台形（奥＝玄関側が狭く、手前ほど広い）。
function roadPolygon(): string {
  const back = project(0, ROAD.y)
  const front = project(0, ROAD.y + ROAD.h)
  const halfBack = ROAD.w / 2
  const halfFront = (ROAD.w / 2) * (1 + ROAD_FLARE)
  return [
    `${180 - halfBack},${back.y.toFixed(1)}`,
    `${180 + halfBack},${back.y.toFixed(1)}`,
    `${180 + halfFront},${front.y.toFixed(1)}`,
    `${180 - halfFront},${front.y.toFixed(1)}`,
  ].join(' ')
}

type Rect = { x: number; y: number; w: number; h: number }

// 平面の矩形（床）。正面投影なので画面上も矩形になる。
function floorRect(r: Rect) {
  const a = project(r.x, r.y)
  const b = project(r.x + r.w, r.y + r.h)
  return { x: a.x, y: a.y, width: r.w, height: b.y - a.y }
}

// 線分を「厚みのある壁」の平面矩形にする。
function wallBox([x1, y1, x2, y2]: Segment): Rect {
  const t = WALL_T / 2
  return {
    x: Math.min(x1, x2) - t,
    y: Math.min(y1, y2) - t,
    w: Math.abs(x2 - x1) + WALL_T,
    h: Math.abs(y2 - y1) + WALL_T,
  }
}

// 壁1枚を、天面（上）＋前面（手前）の2面で立体に見せる。
function WallBox({ box, h = WALL_H }: { box: Rect; h?: number }) {
  const topBack = project(box.x, box.y, h)
  const topFront = project(box.x, box.y + box.h, h)
  const frontBottom = project(box.x, box.y + box.h, 0)

  return (
    <g>
      {/* 前面（手前を向く面）。根元は濃く、上へ向かって溶ける */}
      <rect x={box.x} y={topFront.y} width={box.w} height={frontBottom.y - topFront.y} fill="url(#fp3d-wall-front)" />
      {/* 石積みの目地（上へ向かって薄れるよう、壁と同じフェードのマスクを掛ける） */}
      <rect
        x={box.x}
        y={topFront.y}
        width={box.w}
        height={frontBottom.y - topFront.y}
        fill="url(#fp3d-wall-stone)"
        mask="url(#fp3d-wall-stone-fade)"
      />
      {/* 天面（薄い厚みの面。低い壁の「切り口」） */}
      <rect x={box.x} y={topBack.y} width={box.w} height={topFront.y - topBack.y} fill="url(#fp3d-wall-top)" />
      {/* 根元のライン（床との接地を締める） */}
      <line x1={box.x} y1={frontBottom.y} x2={box.x + box.w} y2={frontBottom.y} stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={0.8} />
    </g>
  )
}

/**
 * 列柱。LP と同じ柱画像（road-pillar.png）の「下半分」を使う。
 * preserveAspectRatio の slice ＋ 下寄せ（xMidYMax）で、画像の上側を切り落として足元だけを見せ、
 * さらに上端をフェード（fp3d-pillar-fade）して朧げに溶かす。
 */
function Column({ cx, cy, r, h = COLUMN_H, mask = 'url(#fp3d-pillar-fade)' }: { cx: number; cy: number; r: number; h?: number; mask?: string }) {
  const base = project(cx, cy)
  const w = r * 3.6 // 柱は太めに（壁より高い部分はマスクで消える）
  const top = base.y - h

  return (
    <g>
      {/* 足元の影（床への接地） */}
      <ellipse cx={base.x} cy={base.y} rx={w * 0.55} ry={w * 0.55 * KY} fill="var(--palace)" fillOpacity={0.25} />
      <image
        href="/road-pillar.png"
        x={base.x - w / 2}
        y={top}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMax slice"
        mask={mask}
        opacity={0.8}
      />
    </g>
  )
}

/**
 * 宮殿の間取り図（3D）。2D と同じ平面データ（floorplan-geometry）を、正面のまま立ち上げる。
 * 壁は低く、上端をぼかして溶かす。玄関から手前へ続く道と、その両脇の列柱も同じ投影で立体化し、
 * 2D の平面図から見た「同じ間取り」がそのまま立ち上がったように見せる。
 */
export function PalaceFloorplan3D({
  onHint,
  icons,
  overlay,
}: {
  onHint: (hint: string | null) => void
  icons: Record<string, ReactNode>
  overlay?: ReactNode
}) {
  const router = useRouter()
  const go = (room: Room) => router.push(room.href)

  // 奥（平面の y が小さい）から手前へ順に描く。
  const walls = [...WALL_SEGMENTS, ...PORCH_SEGMENTS]
    .map(wallBox)
    .sort((a, b) => a.y - b.y)

  return (
    <>
      <div className="relative w-full" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full">
        <defs>
          {/* 壁の前面：根元は濃く、上へ向かって溶ける */}
          <linearGradient id="fp3d-wall-front" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--foreground)" stopOpacity={0.45} />
            <stop offset="0.6" stopColor="var(--foreground)" stopOpacity={0.24} />
            <stop offset="1" stopColor="var(--foreground)" stopOpacity={0.05} />
          </linearGradient>
          {/* 壁の天面：前面より明るい石の面 */}
          <linearGradient id="fp3d-wall-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--palace)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--palace)" stopOpacity={0.18} />
          </linearGradient>
          {/* 柱：壁の高さまでは見せ、それより上（＝壁から突き出る部分）は透明へ溶かす */}
          <linearGradient id="fp3d-pillar-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset={WALL_H / COLUMN_H} stopColor="#fff" stopOpacity={0.85} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id="fp3d-pillar-fade" maskContentUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="1" fill="url(#fp3d-pillar-grad)" />
          </mask>
          {/* 石積みの目地も上へ向かって溶かす */}
          <linearGradient id="fp3d-stone-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset="0.6" stopColor="#fff" stopOpacity={0.5} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id="fp3d-wall-stone-fade" maskContentUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="1" fill="url(#fp3d-stone-grad)" />
          </mask>
          {/* 壁の上部をぼかす */}
          <filter id="fp3d-wall-blur" x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
          {/* 壁の石積み（目地の入った石ブロック） */}
          <pattern id="fp3d-wall-stone" width="10" height="5" patternUnits="userSpaceOnUse">
            <rect width="10" height="5" fill="none" />
            {/* 横目地 */}
            <path d="M0,0 H10 M0,5 H10" stroke="var(--foreground)" strokeOpacity={0.18} strokeWidth={0.4} />
            {/* 縦目地（段ごとに半個ずらして石積みに見せる） */}
            <path d="M5,0 V2.5 M0,2.5 V5 M10,2.5 V5" stroke="var(--foreground)" strokeOpacity={0.14} strokeWidth={0.4} />
          </pattern>
          {/* 床の石畳（薄い格子） */}
          <pattern id="fp3d-floor" width="20" height={20 * KY} patternUnits="userSpaceOnUse">
            <rect width="20" height={20 * KY} fill="var(--palace)" fillOpacity={0.05} />
            <path d={`M0,0 H20 M0,0 V${20 * KY}`} stroke="var(--palace)" strokeOpacity={0.14} strokeWidth={0.5} />
          </pattern>
        </defs>

        {/* 建物の下の地面（淡く敷いて、道や余白と馴染ませる） */}
        <rect
          x={STYLOBATE.x - 14}
          y={project(0, STYLOBATE.y - 8).y}
          width={STYLOBATE.w + 28}
          height={project(0, STYLOBATE.y + STYLOBATE.h + 14).y - project(0, STYLOBATE.y - 8).y}
          rx={6}
          fill="var(--palace)"
          fillOpacity={0.04}
        />

        {/* 基壇 → 建物の床（石畳）→ 中庭 → 玄関（現在地） */}
        <rect {...floorRect(STYLOBATE)} fill="var(--palace)" fillOpacity={0.08} stroke="var(--palace)" strokeOpacity={0.3} strokeWidth={0.8} />
        <rect {...floorRect(BUILDING_FLOOR)} fill="url(#fp3d-floor)" />
        <rect {...floorRect(COURTYARD)} fill="var(--palace)" fillOpacity={0.04} stroke="var(--palace)" strokeOpacity={0.2} strokeWidth={0.6} />
        <rect {...floorRect(PORCH_FLOOR)} fill="var(--palace)" fillOpacity={0.16} />

        {/* 中庭の炉（泉） */}
        <ellipse cx={HEARTH.x} cy={project(HEARTH.x, HEARTH.y).y} rx={9} ry={9 * KY} fill="none" stroke="var(--palace)" strokeOpacity={0.5} strokeWidth={1} />
        <ellipse cx={HEARTH.x} cy={project(HEARTH.x, HEARTH.y).y} rx={3.6} ry={3.6 * KY} fill="var(--palace)" fillOpacity={0.4} />

        {/* エントランスと中庭の間の低い仕切り */}
        {PARTITION_SEGMENTS.map((seg, i) => (
          <WallBox key={`part-${i}`} box={wallBox(seg)} h={6} />
        ))}

        {/* 壁（奥から手前へ）。上部がぼやけるよう、グループ全体に軽いブラーを掛ける */}
        <g filter="url(#fp3d-wall-blur)">
          {walls.map((box, i) => (
            <WallBox key={`wall-${i}`} box={box} />
          ))}
        </g>

        {/* 中庭・ポルチコの列柱（奥から手前へ） */}
        {[...COLUMNS]
          .sort((a, b) => a[1] - b[1])
          .map(([cx, cy, r], i) => (
            <Column key={`col-${i}`} cx={cx} cy={cy} r={r} />
          ))}

        {/* 部屋のクリック領域（床の上に重ねる） */}
        {ROOMS.map((room) => (
          <rect
            key={room.key}
            {...floorRect(room.rect)}
            rx={2}
            role="link"
            tabIndex={0}
            aria-label={`${room.label}へ`}
            aria-current={room.current ? 'page' : undefined}
            onClick={() => go(room)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') go(room)
            }}
            onMouseEnter={() => onHint(`${room.label} — ${room.desc}`)}
            onMouseLeave={() => onHint(null)}
            onFocus={() => onHint(`${room.label} — ${room.desc}`)}
            onBlur={() => onHint(null)}
            // 塗りは CSS で当てる（SVG の presentation 属性より CSS が優先されるので、ホバーで効く）
            className="cursor-pointer fill-transparent outline-none transition-colors hover:fill-[rgba(198,167,94,0.18)] focus-visible:fill-[rgba(198,167,94,0.18)]"
          />
        ))}
      </svg>

      {/* 部屋のラベル（クリックは下の rect が受ける） */}
      {ROOMS.map((room) => {
        const c = project(room.rect.x + room.rect.w / 2, room.rect.y + room.rect.h / 2)
        return (
          <div
            key={room.key}
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center"
            style={{ left: `${(c.x / VB.w) * 100}%`, top: `${(c.y / VB.h) * 100}%` }}
          >
            <span style={{ color: 'var(--palace)' }}>{icons[room.key]}</span>
            <span className="text-[13px] font-medium leading-tight">{room.label}</span>
            {room.current && <span className="text-[10px] font-medium text-muted-foreground">現在地</span>}
          </div>
        )
      })}

      {/* 裏口の行き先 */}
      <span
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground"
        style={{
          left: `${(BACK_EXIT.x / VB.w) * 100}%`,
          top: `${((project(BACK_EXIT.x, BACK_EXIT.y).y - WALL_H - 8) / VB.h) * 100}%`,
        }}
      >
        宮殿外へ
      </span>
      </div>

      {/* 玄関の先へ続く道（2D と同じ高さの帯に、続きの投影で描く） */}
      <Road3D overlay={overlay} />
    </>
  )
}

/**
 * 玄関の先へ続く道（3D）。建物と同じ投影で描き、2D と同じ高さの帯（128px）に収める。
 * 道の縁に沿って細い列柱を立て、手前ほど朧げに溶かす。
 */
function Road3D({ overlay }: { overlay?: ReactNode }) {
  return (
    <div className="relative -mt-1 h-32 w-full">
      <svg
        viewBox={`0 ${project(0, ROAD_VB.y).y} ${VB.w} ${ROAD_VB.h}`}
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          {/* 道のテクスチャ（LP と同じ road.png をタイルする） */}
          <pattern id="fp3d-road" width={ROAD.w} height={30} patternUnits="userSpaceOnUse" patternTransform={`translate(${ROAD.x} 0)`}>
            <image href="/road.png" width={ROAD.w} height={30} preserveAspectRatio="none" />
          </pattern>
          {/* 柱は上へ向かって朧げに溶ける */}
          <linearGradient id="fp3d-road-pillar-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset="0.55" stopColor="#fff" stopOpacity={0.75} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id="fp3d-pillar-fade" maskContentUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="1" fill="url(#fp3d-road-pillar-grad)" />
          </mask>
          {/* 手前ほど溶けるフェード（道の範囲ぴったりに掛ける） */}
          <linearGradient
            id="fp3d-road-fade"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={project(0, ROAD.y).y}
            x2="0"
            y2={project(0, ROAD.y + ROAD.h).y}
          >
            <stop offset="0" stopColor="#fff" stopOpacity={1} />
            <stop offset="0.62" stopColor="#fff" stopOpacity={0.6} />
            <stop offset="1" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id="fp3d-road-mask" maskUnits="userSpaceOnUse" x="0" y={project(0, ROAD.y).y} width={VB.w} height={ROAD_VB.h}>
            <rect x="0" y={project(0, ROAD.y).y} width={VB.w} height={ROAD_VB.h} fill="url(#fp3d-road-fade)" />
          </mask>
        </defs>

        {/* エントランスから下りる階段（奥ほど幅広・手前へ下る）。玄関と道の高さを繋ぐ */}
        {Array.from({ length: STAIRS.steps }).map((_, i) => {
          const t0 = i / STAIRS.steps
          const t1 = (i + 1) / STAIRS.steps
          const y0 = STAIRS.y + STAIRS.h * t0
          const y1 = STAIRS.y + STAIRS.h * t1
          const w0 = STAIRS.topW + (STAIRS.bottomW - STAIRS.topW) * t0
          const z = STAIRS.z * (1 - t0)
          const top0 = project(0, y0, z)
          const top1 = project(0, y1, z)
          const front = project(0, y1, z - STAIRS.z / STAIRS.steps)
          return (
            <g key={`stair-${i}`}>
              {/* 踏み面 */}
              <rect x={180 - w0 / 2} y={top0.y} width={w0} height={top1.y - top0.y} fill="var(--palace)" fillOpacity={0.12} />
              {/* 蹴上げ（段の立ち上がり） */}
              <rect x={180 - w0 / 2} y={top1.y} width={w0} height={front.y - top1.y} fill="var(--foreground)" fillOpacity={0.12} />
              <line x1={180 - w0 / 2} y1={top1.y} x2={180 + w0 / 2} y2={top1.y} stroke="var(--palace)" strokeOpacity={0.4} strokeWidth={0.5} />
            </g>
          )
        })}

        <g mask="url(#fp3d-road-mask)" opacity={0.6}>
          {/* 道：建物の投影に合わせ、奥（玄関側）ほど狭い台形にする */}
          <polygon points={roadPolygon()} fill="url(#fp3d-road)" opacity={0.5} />
          <polygon points={roadPolygon()} fill="var(--palace)" fillOpacity={0.06} />
          {[...ROAD_COLUMNS]
            .sort((a, b) => a[1] - b[1])
            .map(([cx, cy], i) => {
              // 柱は道の縁に沿わせる（手前ほど広がる）。
              const t = (cy - ROAD.y) / ROAD.h
              const halfW = (ROAD.w / 2) * (1 + t * ROAD_FLARE)
              const x = cx < 180 ? 180 - halfW - 4 : 180 + halfW + 4
              return <Column key={`road-col-${i}`} cx={x} cy={cy} r={2.4 + t * 1.2} h={13 + t * 5} />
            })}
        </g>
      </svg>

      {/* 道の上に重ねる説明（吹き出し・操作ヒント） */}
      {overlay && (
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center px-2">{overlay}</div>
      )}
    </div>
  )
}
