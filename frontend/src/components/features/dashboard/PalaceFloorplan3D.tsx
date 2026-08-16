'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Footprints, ArrowUpRight } from 'lucide-react'
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
import { useMotion } from '@/hooks/useMotion'

// 投影：平面の奥（+y）へ進むほど画面では上へ詰まり（KY）、高さ z は上へ持ち上げる。
// 固定のせん断は入れない（yaw = 0 のとき＝正面向きは、傾かずまっすぐ見える）。
// 斜めの角度は「縦軸まわりの回転（yaw）」からだけ生まれる。
const KY = 0.62
const OX = 0
const OY = 44
// 建物は 2D と同じ枠（360×158）。道は描かないので、そのぶん宮殿を大きく取る。
const VB = { w: 360, h: 158 }

const WALL_H = 18 // 壁は低く抑え、上端をぼかして溶かす
const WALL_T = 4 // 壁の厚み（2D の線の太さと同じ）
const COLUMN_H = 24

type P = { x: number; y: number }
type Rect = { x: number; y: number; w: number; h: number }

// 玄関（ポルチコ前 y=150）の先へ続く道。宮殿と同じ平面座標で置く。
// 長さは控えめ（元の約2/3）にして、白っぽく薄めに敷く。
const ROAD: Rect = { x: 142, y: 156, w: 76, h: 37 }

// 回転の軸（宮殿の中心を貫く縦軸）。この点を中心に、平面ごと回してから投影する。
const PIVOT = { x: 180, y: 72 }
// 回っても枠に収まるよう、わずかに余白を残す。
// 2D（平面図）と縦の高さを揃えるため全体を少し縮める（はみ出しは許容）。
const FIT = 0.86

// 平面座標を「縦軸まわりに yaw だけ回してから」アイソメへ投影する。
// CSS で絵を回すのと違い、比率も接地も崩れない（記憶資産カードと同じ手法）。
function project(x: number, y: number, z = 0, yaw = 0): P {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const dx = x - PIVOT.x
  const dy = y - PIVOT.y
  const rx = PIVOT.x + dx * cos - dy * sin
  const ry = PIVOT.y + dx * sin + dy * cos
  const sx = rx + OX
  const sy = ry * KY - z + OY
  // 軸の投影点を中心に縮小して、回転しても枠から出ないようにする。
  const px = PIVOT.x + OX
  const py = PIVOT.y * KY + OY
  return { x: px + (sx - px) * FIT, y: py + (sy - py) * FIT }
}

const p = (pt: P) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`

// 平面の矩形を、投影した四角形（回転すると平行四辺形になる）の points にする。
function quad(r: Rect, z = 0, yaw = 0): string {
  return [
    project(r.x, r.y, z, yaw),
    project(r.x + r.w, r.y, z, yaw),
    project(r.x + r.w, r.y + r.h, z, yaw),
    project(r.x, r.y + r.h, z, yaw),
  ]
    .map(p)
    .join(' ')
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

// 壁1枚を、天面・前面・側面の3面で立体に見せる（斜投影なので側面も見える）。
function WallBox({ box, h = WALL_H, yaw = 0 }: { box: Rect; h?: number; yaw?: number }) {
  const x0 = box.x
  const x1 = box.x + box.w
  const y0 = box.y
  const y1 = box.y + box.h

  // 底面の四隅（回転後）。側面は4枚とも作り、奥のものから描く。
  const base = [
    project(x0, y0, 0, yaw),
    project(x1, y0, 0, yaw),
    project(x1, y1, 0, yaw),
    project(x0, y1, 0, yaw),
  ]
  const cx = (base[0].x + base[2].x) / 2

  const sides = base.map((pt, i) => {
    const next = base[(i + 1) % 4]
    const mid = { x: (pt.x + next.x) / 2, y: (pt.y + next.y) / 2 }
    return {
      points: `${p(pt)} ${p(next)} ${p({ x: next.x, y: next.y - h })} ${p({ x: pt.x, y: pt.y - h })}`,
      depth: mid.y,
      // 画面の左を向く面は影側（濃く）、右を向く面は明るく。
      fill: mid.x < cx ? 'url(#fp3d-wall-side)' : 'url(#fp3d-wall-front)',
      lit: mid.x >= cx,
    }
  })
  sides.sort((a, b) => a.depth - b.depth)

  return (
    <g>
      {sides.map((side, i) => (
        <g key={i}>
          <polygon points={side.points} fill={side.fill} />
          {/* 石積みの目地（上へ向かって薄れる） */}
          <polygon points={side.points} fill="url(#fp3d-wall-stone)" mask="url(#fp3d-wall-stone-fade)" />
        </g>
      ))}
      {/* 天面（低い壁の切り口） */}
      <polygon points={quad(box, h, yaw)} fill="url(#fp3d-wall-top)" />
    </g>
  )
}

/**
 * 列柱。LP と同じ柱画像（road-pillar.png）の下側だけを使い、
 * 壁より高い部分はマスクで透明へ溶かす。
 */
// road=true（宮殿下・玄関側の柱）は白っぽく薄めに描く。
function Column({ cx, cy, r, h = COLUMN_H, yaw = 0, road = false }: { cx: number; cy: number; r: number; h?: number; yaw?: number; road?: boolean }) {
  const base = project(cx, cy, 0, yaw)
  const w = r * 3.6
  const top = base.y - h

  return (
    <g style={road ? { filter: 'saturate(0.2) brightness(1.7)' } : undefined}>
      <ellipse cx={base.x} cy={base.y} rx={w * 0.55} ry={w * 0.55 * KY} fill={road ? 'white' : 'var(--palace)'} fillOpacity={road ? 0.2 : 0.35} />
      <image
        href="/road-pillar.png"
        x={base.x - w / 2}
        y={top}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMax slice"
        mask="url(#fp3d-pillar-fade)"
        opacity={road ? 0.55 : 0.95}
      />
    </g>
  )
}

// 縦軸まわりの回転（アニメーション ON のときだけ）。CSS で絵を回すと比率が崩れるため、
// 記憶資産カードと同じく「平面で回してから投影する」方式にする。
// 首振り（反転）ではなく、一周をゆっくり繰り返す連続回転にする（回転中に宮殿の端が
// カード枠からはみ出して切れるのは許容する）。
const SPIN_PERIOD_MS = 54000 // 一周にかける時間（速度を 2/3 に＝周期は 1.5 倍でさらにゆっくり）

// enabled: アニメーション設定が ON か。paused: ホバー中か（その角度のまま止める）。
function useYaw(enabled: boolean, paused: boolean): number {
  const [yaw, setYaw] = useState(0)
  const tRef = useRef(0)

  useEffect(() => {
    if (!enabled || paused) return

    let raf = 0
    let last: number | null = null
    const tick = (now: number) => {
      if (last !== null) {
        tRef.current += now - last
        // 連続回転：時間に比例して 0→2π を繰り返す。
        setYaw(((tRef.current / SPIN_PERIOD_MS) * Math.PI * 2) % (Math.PI * 2))
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [enabled, paused])

  // アニメーション OFF のときは常に正面向き。ホバー中は最後の角度のまま止まる。
  return enabled ? yaw : 0
}

// ラベルは回転しても水平のまま（位置だけ追随する）。回転コンテナ側の
// palace3d-spin と同じ周期で逆回転させる（globals.css の palace3d-label）。
function Label({ at, children }: { at: P; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center"
      style={{ left: `${(at.x / VB.w) * 100}%`, top: `${(at.y / VB.h) * 100}%` }}
    >
      {children}
    </div>
  )
}

// 平面の矩形に画像を貼る。投影後は平行四辺形になるので、matrix で写す
// （宮殿と同じ yaw で回るので、道も宮殿にぴったり追随する）。
function PlanImage({ rect, href, yaw, opacity = 1, mask }: { rect: Rect; href: string; yaw: number; opacity?: number; mask?: string }) {
  const o = project(rect.x, rect.y, 0, yaw)
  const ex = project(rect.x + rect.w, rect.y, 0, yaw)
  const ey = project(rect.x, rect.y + rect.h, 0, yaw)
  const a = (ex.x - o.x) / rect.w
  const b = (ex.y - o.y) / rect.w
  const c = (ey.x - o.x) / rect.h
  const d = (ey.y - o.y) / rect.h

  return (
    <image
      href={href}
      x={0}
      y={0}
      width={rect.w}
      height={rect.h}
      preserveAspectRatio="none"
      transform={`matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${o.x.toFixed(2)} ${o.y.toFixed(2)})`}
      opacity={opacity}
      mask={mask}
    />
  )
}

/**
 * 宮殿の間取り図（3D・アイソメの斜投影）。2D と同じ平面データ（floorplan-geometry）を立ち上げる。
 * 壁は低く石積みで、上端はぼかして溶かす。玄関から下りる階段と、その先の道・列柱も同じ投影で描く。
 */
export function PalaceFloorplan3D({
  onHint,
  icons,
}: {
  onHint: (hint: string | null) => void
  icons: Record<string, ReactNode>
}) {
  const router = useRouter()
  const go = (room: Room) => router.push(room.href)
  const [hovered, setHovered] = useState(false)
  // ホバー中の部屋（その右上に足跡アイコンを出す）。ホバー中は回転も止まるので位置は動かない。
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const animations = useMotion()
  const yaw = useYaw(animations, hovered)

  // 回転後の奥行き（画面上の y）が小さいものから描く。
  const walls = [...WALL_SEGMENTS, ...PORCH_SEGMENTS]
    .map(wallBox)
    .sort((a, b) => project(a.x + a.w / 2, a.y + a.h / 2, 0, yaw).y - project(b.x + b.w / 2, b.y + b.h / 2, 0, yaw).y)

  return (
    <>
      <div className="relative w-full" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="absolute inset-0 h-full w-full"
          // 枠外（トグルの行や下の余白）へはみ出しても切り取らない。
          // クリップされると、はみ出した柱や壁が直線でスパッと切れて見えるため。
          style={{ overflow: 'visible' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <defs>
            {/* 壁は「日に焼けた石灰岩」の色。面の向きで明るさを変える（天面＝陽が当たる、
                前面＝中間、側面＝影）。

                色は**隣の「宮殿の記憶資産」の積み木と同じ**にする。
                並んだ2枚のカードで同じ宮殿の石を描いているのに、別々の色を持っていた。
                同じものが場所によって違う色をしていると、別の素材に見える。

                基準はカードの積み木（top #DCC488 / left #C6A75E / right #A2803B）。
                4種の中でこれを選ぶのは、left がちょうど差し色の金（--palace）そのもので、
                画面全体の基準色になっているため。

                根元（offset 0）を積み木の面の色と同じにし、上へ向けて明るく薄くする
                （壁は上端をぼかして地に溶かすため、ここだけは積み木と違ってよい）。 */}
            <linearGradient id="fp3d-wall-front" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#C6A75E" stopOpacity={1} />
              <stop offset="0.6" stopColor="#D6C08A" stopOpacity={0.98} />
              <stop offset="1" stopColor="#E6D8B2" stopOpacity={0.62} />
            </linearGradient>
            <linearGradient id="fp3d-wall-side" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#A2803B" stopOpacity={1} />
              <stop offset="0.6" stopColor="#B99C68" stopOpacity={0.98} />
              <stop offset="1" stopColor="#D0BC94" stopOpacity={0.56} />
            </linearGradient>
            <linearGradient id="fp3d-wall-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#EFE2C0" stopOpacity={1} />
              <stop offset="1" stopColor="#DCC488" stopOpacity={1} />
            </linearGradient>
            {/* 壁の石積み（目地。段ごとに半個ずらす） */}
            <pattern id="fp3d-wall-stone" width="10" height="5" patternUnits="userSpaceOnUse">
              <path d="M0,0 H10 M0,5 H10" stroke="#9C8552" strokeOpacity={0.35} strokeWidth={0.4} />
              <path d="M5,0 V2.5 M0,2.5 V5 M10,2.5 V5" stroke="#9C8552" strokeOpacity={0.28} strokeWidth={0.4} />
            </pattern>
            <linearGradient id="fp3d-stone-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity={1} />
              <stop offset="0.6" stopColor="#fff" stopOpacity={0.5} />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <mask id="fp3d-wall-stone-fade" maskContentUnits="objectBoundingBox">
              <rect x="0" y="0" width="1" height="1" fill="url(#fp3d-stone-grad)" />
            </mask>
            {/* 柱：壁の高さまでは見せ、それより上は透明へ溶かす */}
            <linearGradient id="fp3d-pillar-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity={1} />
              <stop offset={WALL_H / COLUMN_H} stopColor="#fff" stopOpacity={0.85} />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <mask id="fp3d-pillar-fade" maskContentUnits="objectBoundingBox">
              <rect x="0" y="0" width="1" height="1" fill="url(#fp3d-pillar-grad)" />
            </mask>
            {/* 壁の上部をぼかす */}
            <filter id="fp3d-wall-blur" x="-10%" y="-20%" width="120%" height="140%">
              <feGaussianBlur stdDeviation="0.35" />
            </filter>
            {/* 道は手前へ向かって溶ける（画像の切り口を隠す） */}
            <linearGradient id="fp3d-road-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
              <stop offset="0.6" stopColor="#fff" stopOpacity={0.5} />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <mask id="fp3d-road-fade" maskContentUnits="objectBoundingBox">
              <rect x="0" y="0" width="1" height="1" fill="url(#fp3d-road-grad)" />
            </mask>
            {/* 床の石畳（斜投影に合わせて平行四辺形の格子にする） */}
            <pattern id="fp3d-floor" width={20} height={20 * KY} patternUnits="userSpaceOnUse">
              <rect width={20} height={20 * KY} fill="var(--palace)" fillOpacity={0.05} />
              <path d={`M0,0 H20 M0,0 V${20 * KY}`} stroke="var(--palace)" strokeOpacity={0.14} strokeWidth={0.5} />
            </pattern>
          </defs>

          {/* 建物の下の地面（淡く敷いて、道や余白と馴染ませる） */}
          <polygon
            points={quad({ x: STYLOBATE.x - 12, y: STYLOBATE.y - 8, w: STYLOBATE.w + 24, h: STYLOBATE.h + 22 }, 0, yaw)}
            fill="var(--palace)"
            fillOpacity={0.04}
          />

          {/* 現在地（エントランス）の下から手前へ続く道。白っぽく薄めに敷く（彩度を落とし明るく） */}
          <g style={{ filter: 'saturate(0.2) brightness(1.6)' }}>
            <PlanImage rect={ROAD} href="/road.png" yaw={yaw} opacity={0.24} mask="url(#fp3d-road-fade)" />
          </g>

          {/* 基壇 → 建物の床（石畳）→ 中庭 → 玄関（現在地） */}
          <polygon points={quad(STYLOBATE, 0, yaw)} fill="var(--palace)" fillOpacity={0.13} stroke="var(--palace)" strokeOpacity={0.45} strokeWidth={0.8} />
          <polygon points={quad(BUILDING_FLOOR, 0, yaw)} fill="var(--palace)" fillOpacity={0.09} />
          <polygon points={quad(COURTYARD, 0, yaw)} fill="var(--palace)" fillOpacity={0.07} stroke="var(--palace)" strokeOpacity={0.32} strokeWidth={0.6} />
          <polygon points={quad(PORCH_FLOOR, 0, yaw)} fill="var(--palace)" fillOpacity={0.24} />

          {/* 中庭の炉（泉） */}
          <ellipse cx={project(HEARTH.x, HEARTH.y, 0, yaw).x} cy={project(HEARTH.x, HEARTH.y, 0, yaw).y} rx={9 * FIT} ry={9 * KY * FIT} fill="none" stroke="var(--palace)" strokeOpacity={0.5} strokeWidth={1} />
          <ellipse cx={project(HEARTH.x, HEARTH.y, 0, yaw).x} cy={project(HEARTH.x, HEARTH.y, 0, yaw).y} rx={3.6 * FIT} ry={3.6 * KY * FIT} fill="var(--palace)" fillOpacity={0.4} />

          {/* エントランスと中庭の間の低い仕切り */}
          {PARTITION_SEGMENTS.map((seg, i) => (
            <WallBox key={`part-${i}`} box={wallBox(seg)} h={6} yaw={yaw} />
          ))}

          {/* 壁（奥から手前へ）。上部がぼやけるよう軽くブラーを掛ける */}
          <g filter="url(#fp3d-wall-blur)">
            {walls.map((box, i) => (
              <WallBox key={`wall-${i}`} box={box} yaw={yaw} />
            ))}
          </g>

          {/* 列柱（奥から手前へ） */}
          {[...COLUMNS]
            .sort((a, b) => project(a[0], a[1], 0, yaw).y - project(b[0], b[1], 0, yaw).y)
            .map(([cx, cy, r], i) => (
              // 玄関側（cy≧140）の列柱は宮殿下の柱として白く薄める
              <Column key={`col-${i}`} cx={cx} cy={cy} r={r} yaw={yaw} road={cy >= 140} />
            ))}

          {/* 部屋のクリック領域（床の上に重ねる） */}
          {ROOMS.map((room) => (
            <polygon
              key={room.key}
              points={quad(room.rect, 0, yaw)}
              role="link"
              tabIndex={0}
              aria-label={`${room.label}へ`}
              aria-current={room.current ? 'page' : undefined}
              onClick={() => go(room)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') go(room)
              }}
              onMouseEnter={() => {
                onHint(`「${room.label}」${room.desc}`)
                setHoveredRoom(room.key)
              }}
              onMouseLeave={() => {
                onHint(null)
                setHoveredRoom(null)
              }}
              onFocus={() => {
                onHint(`「${room.label}」${room.desc}`)
                setHoveredRoom(room.key)
              }}
              onBlur={() => {
                onHint(null)
                setHoveredRoom(null)
              }}
              // 塗りは CSS で当てる（SVG の presentation 属性より CSS が優先されるので、ホバーで効く）
              className="cursor-pointer fill-transparent outline-none transition-colors hover:fill-[rgba(198,167,94,0.18)] focus-visible:fill-[rgba(198,167,94,0.18)]"
            />
          ))}
        </svg>

        {/* 部屋のラベル（回転しても水平のまま。位置だけ追随する） */}
        {ROOMS.map((room) => (
          <Label key={room.key} at={project(room.rect.x + room.rect.w / 2, room.rect.y + room.rect.h / 2, 0, yaw)}>
            <span style={{ color: 'var(--palace)' }}>{icons[room.key]}</span>
            <span className="text-[13px] font-medium leading-tight">{room.label}</span>
            {room.current && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                現在地
              </span>
            )}
          </Label>
        ))}

        {/* ホバー中の部屋の右上に足跡（＝この部屋へ移動できる合図） */}
        {ROOMS.map((room) =>
          hoveredRoom === room.key ? (
            <Label key={`fs-${room.key}`} at={project(room.rect.x + room.rect.w, room.rect.y, 0, yaw)}>
              <span className="flex items-center gap-0.5" style={{ color: 'var(--palace)' }}>
                <ArrowUpRight size={12} />
                <Footprints size={13} />
              </span>
            </Label>
          ) : null,
        )}

        {/* 裏口の行き先 */}
        <Label at={{ ...project(BACK_EXIT.x, BACK_EXIT.y, 0, yaw), y: project(BACK_EXIT.x, BACK_EXIT.y, WALL_H + 8, yaw).y }}>
          <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">市街へ</span>
        </Label>
      </div>
    </>
  )
}
