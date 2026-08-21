'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Footprints, ArrowUpRight, X } from 'lucide-react'
import { DEMO_LOCKED_HINT, lockedForDemo } from '@/lib/demo/navigation'
import { useIsDemo } from '@/components/features/demo/DemoLock'
import {
  ROOMS,
  OUTER_WALL_SEGMENTS,
  INNER_WALL_SEGMENTS,
  PORCH_SEGMENTS,
  PARTITION_SEGMENTS,
  BUILDING_FLOOR,
  PORCH_FLOOR,
  COLUMNS,
  HEARTH,
  PLAN_VIEWBOX,
  segmentsToPath,
} from './floorplan-geometry'

const OUTER_WALLS = segmentsToPath(OUTER_WALL_SEGMENTS)
const INNER_WALLS = segmentsToPath(INNER_WALL_SEGMENTS)
const PORCH = segmentsToPath(PORCH_SEGMENTS)
const PARTITION = segmentsToPath(PARTITION_SEGMENTS)

// 壁の線色：記憶資産の明るい天面トーン（サンド金）に寄せる。黒は混ぜず、金（--palace=#C6A75E）に
// 白を少し混ぜて明るいサンド色にする。パキッと感は不透明度側で担保する。
const WALL_STROKE = 'color-mix(in srgb, var(--palace) 88%, white)'

// 基壇（スタイロベート）の縁取り。上辺は裏口の開口ぶんを開ける。
const STYLOBATE_PATH = 'M24,6 L160,6 M200,6 L336,6 M24,6 L24,132 M336,6 L336,132'

// 平面座標を viewBox に対する％へ（部屋のクリック領域を重ねるため）。
const pct = (v: number, total: number) => `${(v / total) * 100}%`

/**
 * 宮殿の間取り図（2D・真上からの平面図）。
 * 3D 版（PalaceFloorplan3D）と同じ平面データ（floorplan-geometry）を使う。
 */
export function PalaceFloorplan2D({
  onHint,
  icons,
}: {
  onHint: (hint: string | null) => void
  icons: Record<string, ReactNode>
}) {
  const isDemo = useIsDemo()
  const { w, h } = PLAN_VIEWBOX

  return (
    // 幅はそのまま、縦だけ詰めてスリムに見せる（表示アスペクトを詰め、SVG は非等比で伸縮）。
    <div className="relative w-full" style={{ aspectRatio: `${w} / ${h * 0.85}` }}>
      {/* 上辺の開口（壁の切れ目）に重ねて、その先の行き先を示す */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground"
        style={{ top: pct(10, h) }}
      >
        市街へ
      </span>

      {/* 床は薄めのままだが、壁・区切り線をはっきり出すため全体の不透明度は上げる（部屋ラベルは SVG 外なので鮮明なまま） */}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} opacity={0.92} aria-hidden>
        {/* 建物の床（ごく薄く）・現在地（エントランス）のハイライト。中庭は塗らない。 */}
        <rect x={BUILDING_FLOOR.x} y={BUILDING_FLOOR.y} width={BUILDING_FLOOR.w} height={BUILDING_FLOOR.h} fill="rgba(198,167,94,0.035)" />
        <rect x={PORCH_FLOOR.x} y={PORCH_FLOOR.y} width={PORCH_FLOOR.w} height={PORCH_FLOOR.h} fill="rgba(198,167,94,0.12)" />
        {/* 基壇 */}
        <path d={STYLOBATE_PATH} fill="none" stroke="var(--palace)" strokeOpacity={0.3} strokeWidth={1.2} />
        {/* 外周壁・玄関（上辺中央は外へ抜ける開口）。区切り線に近いくらいまで薄め、サンド色寄りで馴染ませる */}
        <path d={OUTER_WALLS} fill="none" stroke={WALL_STROKE} strokeOpacity={0.82} strokeWidth={4} strokeLinecap="square" />
        <path d={PORCH} fill="none" stroke={WALL_STROKE} strokeOpacity={0.82} strokeWidth={4} strokeLinecap="square" />
        {/* 部屋の区切り線（内側の間仕切り）。金系ではっきり見せる */}
        <path d={INNER_WALLS} fill="none" stroke={WALL_STROKE} strokeOpacity={0.66} strokeWidth={2.6} strokeLinecap="round" />
        {/* エントランスと中庭の軽い仕切り */}
        <path d={PARTITION} fill="none" stroke={WALL_STROKE} strokeOpacity={0.72} strokeWidth={1.6} strokeLinecap="round" />
        {/* 中庭の中央（炉／泉のような装飾） */}
        <circle cx={HEARTH.x} cy={HEARTH.y} r={8} fill="none" stroke="var(--palace)" strokeOpacity={0.55} strokeWidth={1.4} />
        <circle cx={HEARTH.x} cy={HEARTH.y} r={3.2} fill="var(--palace)" fillOpacity={0.4} />
        {/* 列柱 */}
        {COLUMNS.map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(198,167,94,0.5)" stroke="var(--palace)" strokeWidth={1} />
        ))}
      </svg>

      {/* 部屋（クリック領域＋アイコン・名前）。壁の内側に重ねる。 */}
      {ROOMS.map((room) => {
        // **体験中に入れない部屋は、消さずに閉ざす。**
        // 地図から消すと「この宮殿にその部屋は無い」と読まれる。
        // 閉ざした扉として置くほうが、宮殿の広さは伝わる
        const locked = isDemo && lockedForDemo({ sectionKey: 'palace', href: room.href })
        const place = {
          position: 'absolute' as const,
          left: pct(room.rect.x, w),
          top: pct(room.rect.y, h),
          width: pct(room.rect.w, w),
          height: pct(room.rect.h, h),
        }

        if (locked) {
          return (
            <span
              key={room.key}
              aria-disabled
              title={DEMO_LOCKED_HINT}
              onMouseEnter={() => onHint(`「${room.label}」${DEMO_LOCKED_HINT}`)}
              onMouseLeave={() => onHint(null)}
              style={place}
              className="flex cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md text-center opacity-40"
            >
              <span className="absolute right-1 top-1" aria-hidden>
                <X size={13} />
              </span>
              <span style={{ color: 'var(--palace)' }}>{icons[room.key]}</span>
              <span className="text-sm font-medium leading-tight">{room.label}</span>
            </span>
          )
        }

        return (
        <Link
          key={room.key}
          href={room.href}
          aria-label={`${room.label}へ`}
          aria-current={room.current ? 'page' : undefined}
          onMouseEnter={() => onHint(`「${room.label}」${room.desc}`)}
          onMouseLeave={() => onHint(null)}
          onFocus={() => onHint(`「${room.label}」${room.desc}`)}
          onBlur={() => onHint(null)}
          style={place}
          className="group flex flex-col items-center justify-center gap-0.5 rounded-md text-center transition-colors hover:bg-[rgba(198,167,94,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
        >
          {/* ホバー／フォーカスで部屋の右上に足跡＋矢印（＝この部屋へ移動できる合図） */}
          <span
            className="pointer-events-none absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ color: 'var(--palace)' }}
            aria-hidden
          >
            <ArrowUpRight size={12} />
            <Footprints size={13} />
          </span>
          <span style={{ color: 'var(--palace)' }}>{icons[room.key]}</span>
          <span className="text-sm font-medium leading-tight">{room.label}</span>
          {room.current && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              現在地
            </span>
          )}
        </Link>
        )
      })}
    </div>
  )
}
