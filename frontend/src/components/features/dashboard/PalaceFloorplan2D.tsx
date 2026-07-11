'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ROOMS,
  WALL_SEGMENTS,
  PORCH_SEGMENTS,
  PARTITION_SEGMENTS,
  BUILDING_FLOOR,
  PORCH_FLOOR,
  COLUMNS,
  HEARTH,
  PLAN_VIEWBOX,
  segmentsToPath,
} from './floorplan-geometry'

const WALLS = segmentsToPath(WALL_SEGMENTS)
const PORCH = segmentsToPath(PORCH_SEGMENTS)
const PARTITION = segmentsToPath(PARTITION_SEGMENTS)

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
  const { w, h } = PLAN_VIEWBOX

  return (
    <div className="relative w-full" style={{ aspectRatio: `${w} / ${h}` }}>
      {/* 上辺の開口（壁の切れ目）に重ねて、その先の行き先を示す */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground"
        style={{ top: pct(10, h) }}
      >
        宮殿外へ
      </span>

      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} aria-hidden>
        {/* 建物の床（ごく薄く）・現在地（エントランス）のハイライト。中庭は塗らない。 */}
        <rect x={BUILDING_FLOOR.x} y={BUILDING_FLOOR.y} width={BUILDING_FLOOR.w} height={BUILDING_FLOOR.h} fill="rgba(198,167,94,0.035)" />
        <rect x={PORCH_FLOOR.x} y={PORCH_FLOOR.y} width={PORCH_FLOOR.w} height={PORCH_FLOOR.h} fill="rgba(198,167,94,0.12)" />
        {/* 基壇 */}
        <path d={STYLOBATE_PATH} fill="none" stroke="var(--palace)" strokeOpacity={0.3} strokeWidth={1.2} />
        {/* 壁・玄関（上辺中央は外へ抜ける開口） */}
        <path d={WALLS} fill="none" stroke="var(--foreground)" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="square" />
        <path d={PORCH} fill="none" stroke="var(--foreground)" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="square" />
        {/* エントランスと中庭の軽い仕切り */}
        <path d={PARTITION} fill="none" stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1.6} strokeLinecap="round" />
        {/* 中庭の中央（炉／泉のような装飾）＋ラベル */}
        <circle cx={HEARTH.x} cy={HEARTH.y} r={8} fill="none" stroke="var(--palace)" strokeOpacity={0.55} strokeWidth={1.4} />
        <circle cx={HEARTH.x} cy={HEARTH.y} r={3.2} fill="var(--palace)" fillOpacity={0.4} />
        <text x={HEARTH.x} y={HEARTH.y + 24} textAnchor="middle" fontSize={9} fill="var(--foreground)" fillOpacity={0.45}>
          中庭
        </text>
        {/* 列柱 */}
        {COLUMNS.map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(198,167,94,0.5)" stroke="var(--palace)" strokeWidth={1} />
        ))}
      </svg>

      {/* 部屋（クリック領域＋アイコン・名前）。壁の内側に重ねる。 */}
      {ROOMS.map((room) => (
        <Link
          key={room.key}
          href={room.href}
          aria-label={`${room.label}へ`}
          aria-current={room.current ? 'page' : undefined}
          onMouseEnter={() => onHint(`${room.label} — ${room.desc}`)}
          onMouseLeave={() => onHint(null)}
          onFocus={() => onHint(`${room.label} — ${room.desc}`)}
          onBlur={() => onHint(null)}
          style={{
            position: 'absolute',
            left: pct(room.rect.x, w),
            top: pct(room.rect.y, h),
            width: pct(room.rect.w, w),
            height: pct(room.rect.h, h),
          }}
          className="group flex flex-col items-center justify-center gap-0.5 rounded-md text-center transition-colors hover:bg-[rgba(198,167,94,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
        >
          <span style={{ color: 'var(--palace)' }}>{icons[room.key]}</span>
          <span className="text-sm font-medium leading-tight">{room.label}</span>
          {room.current && <span className="text-[10px] font-medium text-muted-foreground">現在地</span>}
        </Link>
      ))}
    </div>
  )
}
