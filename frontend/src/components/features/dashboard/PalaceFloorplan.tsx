'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { DoorOpen, Palette, LibraryBig, GraduationCap, House } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDiagramMode } from '@/hooks/useDiagramMode'
import { DiagramModeToggle } from './DiagramModeToggle'
import { PalaceFloorplan2D } from './PalaceFloorplan2D'
import { PalaceFloorplan3D } from './PalaceFloorplan3D'
import { ROOMS } from './floorplan-geometry'

// 部屋のアイコン（2D/3D で共用）。
const ROOM_ICONS: Record<string, ReactNode> = {
  library: <LibraryBig size={18} />,
  study: <GraduationCap size={18} />,
  atelier: <Palette size={18} />,
  myroom: <House size={18} />,
  entrance: <DoorOpen size={18} />,
}

// 玄関から手前へ伸びる道（2D）。中ほどまでは濃さを保ち、最下部だけ透明へ落として余白に溶かす。
const ROAD_FADE = 'linear-gradient(to bottom, black 30%, rgba(0,0,0,0.5) 72%, transparent 100%)'

// 2D の道の両脇に立つ列柱（道のコンテナ 160×128 に対する座標）。
const ROAD_COLUMNS_2D: [number, number][] = [
  [48, 30], [112, 30],
  [48, 60], [112, 60],
  [48, 90], [112, 90],
  [48, 120], [112, 120],
]

/**
 * 宮殿の「間取り」カード。2D（真上からの平面図）と 3D（正面のまま立ち上げた立体）を切り替えられる。
 * どちらのモードでも同じ平面データ（floorplan-geometry）から描くので、間取りは一致する。
 * 3D では玄関の先の道と両脇の列柱も同じ投影で立体化する。
 */
export function PalaceFloorplan() {
  const [mode, setMode] = useDiagramMode('floorplan')
  const [hint, setHint] = useState<string | null>(null)

  // 未ホバー時は、このページ（エントランス）の説明を既定で表示する。
  const current = ROOMS.find((r) => r.current)
  const defaultHint = current ? `${current.label} — ${current.desc}` : ''

  // 説明の吹き出しと操作ヒント（2D は道の上に、3D は道の途中に重ねる）。
  const overlay = (
    <>
      <div className="relative rounded-lg border border-border bg-background/80 px-3 py-1 text-center text-xs text-muted-foreground backdrop-blur-sm">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-border bg-background/80" />
        {hint ?? defaultHint}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
        各部屋にカーソルを合わせると説明、クリックでその場所へ
      </p>
    </>
  )

  return (
    <Card>
      <CardContent>
        {/* トグルは図より前面に置く（3D が上へはみ出しても、図が切れずに背後を通る） */}
        <div className="relative z-10 mb-1 flex justify-end">
          <DiagramModeToggle mode={mode} onChange={setMode} label="宮殿の間取り図" />
        </div>

        {mode === '3d' ? (
          // 3D では道も同じ投影で描くので、下の 2D 用の道は出さない。
          // アニメーション ON のときは、図（建物＋道）が縦軸まわりに回る（投影ごと回すので比率は崩れない）。
          // 吹き出し・操作ヒントは回転の外に置くので回らない。
          <div className="relative">
            <PalaceFloorplan3D onHint={setHint} icons={ROOM_ICONS} />
            <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center px-2">
              {overlay}
            </div>
          </div>
        ) : (
          <>
            <PalaceFloorplan2D onHint={setHint} icons={ROOM_ICONS} />

            {/* エントランスのドアの下：玄関から手前へ続く道を、間取り図と同じ石畳の平面図で描く。
                左右に列柱を立て、その上に説明の吹き出しと操作ヒントを重ねる。 */}
            <div className="relative -mt-1 h-32 w-full">
              <div className="absolute left-1/2 top-0 h-full w-40 -translate-x-1/2" aria-hidden>
                <svg
                  viewBox="0 0 160 128"
                  className="absolute inset-0 h-full w-full"
                  style={{ WebkitMaskImage: ROAD_FADE, maskImage: ROAD_FADE }}
                >
                  {/* 道の路面（柱（x=48 / 112・r=6.5）に接しないよう、内側に細く通す） */}
                  <rect x={62} y={0} width={36} height={128} fill="var(--palace)" fillOpacity={0.08} />
                  {/* 石畳（細かめ。段ごとに半個ずらして敷く） */}
                  {Array.from({ length: 16 }).map((_, row) => {
                    const y = row * 8
                    const offset = row % 2 === 0 ? 0 : -6
                    return Array.from({ length: 4 }).map((__, col) => {
                      const raw = 62 + offset + col * 12
                      const x = Math.max(62, raw)
                      const width = Math.min(12, 98 - x) - 1.5
                      if (width <= 0) return null
                      return (
                        <rect
                          key={`${row}-${col}`}
                          x={x}
                          y={y + 0.75}
                          width={width}
                          height={6.5}
                          rx={0.8}
                          fill="var(--palace)"
                          fillOpacity={(row + col) % 2 === 0 ? 0.12 : 0.06}
                          stroke="var(--palace)"
                          strokeOpacity={0.28}
                          strokeWidth={0.4}
                        />
                      )
                    })
                  })}
                  {/* 道の両縁 */}
                  <path d="M62,0 V128 M98,0 V128" stroke="var(--palace)" strokeOpacity={0.4} strokeWidth={0.8} />
                  {/* 両脇の列柱 */}
                  {ROAD_COLUMNS_2D.map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r={6.5} fill="rgba(198,167,94,0.5)" stroke="var(--palace)" strokeWidth={1.6} />
                  ))}
                </svg>
              </div>

              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center px-2">{overlay}</div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
