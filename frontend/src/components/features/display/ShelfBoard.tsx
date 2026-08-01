'use client'

import type { ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings'
import {
  DEFAULT_DISPLAY_STYLE,
  DEFAULT_SHELF_ORIENTATION,
  isDisplayStyle,
  isShelfOrientation,
  type Surface,
} from '@/lib/display-style'

/** 現在の表示スタイル。設定が届くまでは既定（宮殿スタイル）で描く */
export function useDisplayStyle() {
  const value = useSettingsStore((s) => s.settings?.display_style)
  return isDisplayStyle(value) ? value : DEFAULT_DISPLAY_STYLE
}

/**
 * 棚の並べ方。シンプル表示のときは段組みしないので rows 固定として扱う。
 * 表示スタイルとは別軸の設定にしてあり、宮殿スタイルのときだけ効く。
 */
export function useShelfOrientation() {
  const style = useDisplayStyle()
  const value = useSettingsStore((s) => s.settings?.shelf_orientation)
  if (style === 'simple') return DEFAULT_SHELF_ORIENTATION
  return isShelfOrientation(value) ? value : DEFAULT_SHELF_ORIENTATION
}

/**
 * 棚を並べる枠。縦棚を横に並べる設定のときだけ段組みにする。
 * 棚の高さは中身で決まるので、列の高さを揃えるために items-stretch を効かせる。
 */
export function ShelfGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  const orientation = useShelfOrientation()
  if (orientation === 'columns') {
    return (
      <div className={`grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
        {children}
      </div>
    )
  }
  return <div className={`space-y-8 ${className}`}>{children}</div>
}

// 大理石の棚。木ではなく石として組み立てる。
// 光は上から当たる前提で、天面は明るく・小口はやや暗く・繰形の陰は最も暗くする。
const MARBLE_LIGHT = 'color-mix(in srgb, var(--ivory) 88%, white)'
const MARBLE_BASE = 'var(--ivory)'
const MARBLE_SHADE = 'color-mix(in srgb, var(--ivory-dark) 85%, var(--foreground))'
const GOLD = 'color-mix(in srgb, var(--palace) 70%, transparent)'
const GOLD_FAINT = 'color-mix(in srgb, var(--palace) 30%, transparent)'

/**
 * 「場」に応じた器。宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする。
 *
 * ライブラリは、大理石の壁面に棚台（マントルピース）が張り出している構成にしている。
 * 奥まった箱にすると中身が沈んで見えるため、面は 2 つだけに絞る。
 *   - 背後は平らな大理石の壁（微かな石目のみ）
 *   - 下は張り出した棚台。天面を明るく、その下にコーニス（歯飾りの繰形）で厚みを出す
 * アイテムは下揃えにして棚台の天面に接地させ、1 つずつ落ち影を持たせる。
 * 「載っている」ことは影と天面の明暗差で示し、遠近の作図には頼らない。
 *
 * 場が増えても設定は増やさない方針なので、何を出すかはここで場ごとに決める。
 * atelier（制作台）/ study（机）は今後この分岐に足す。
 */
export function SurfaceBoard({ surface, children }: { surface: Surface; children: ReactNode }) {
  const style = useDisplayStyle()

  if (style === 'simple' || surface !== 'library') return <>{children}</>

  // 縦棚を横に並べるときは列いっぱいまで伸ばし、棚台の高さを揃える
  return (
    <div className="relative flex h-full flex-col">
      {/* 大理石の壁面。アイテムはこの面の手前に立つ */}
      <div
        className="relative flex flex-1 items-end overflow-hidden rounded-t-xl px-5 pt-6 sm:px-7"
        style={{
          background: `linear-gradient(to bottom, ${MARBLE_LIGHT} 0%, ${MARBLE_BASE} 100%)`,
          boxShadow: `inset 0 0 0 1px ${GOLD_FAINT}, inset 0 14px 18px -16px color-mix(in srgb, var(--foreground) 45%, transparent)`,
        }}
      >
        {/* 石目。うっすら斜めに流して、単色の板に見えないようにする */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(104deg, transparent 0 38%, ${MARBLE_SHADE} 38% 38.5%, transparent 38.5% 62%, ${MARBLE_SHADE} 62% 62.4%, transparent 62.4%), linear-gradient(72deg, transparent 0 74%, ${MARBLE_SHADE} 74% 74.5%, transparent 74.5%)`,
            opacity: 0.14,
          }}
        />

        {/* 左右の付柱。柱頭・溝彫りの柱身・柱脚の 3 部で、区画の両端を締める */}
        {(['left', 'right'] as const).map((side) => (
          <span
            key={`pilaster-${side}`}
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 flex w-3 flex-col sm:w-4 ${side === 'left' ? 'left-0' : 'right-0'}`}
          >
            <span
              className="h-2.5 w-full shrink-0"
              style={{
                background: `linear-gradient(to bottom, ${MARBLE_LIGHT}, ${MARBLE_BASE} 60%, ${MARBLE_SHADE})`,
                boxShadow: `0 1px 0 ${GOLD}`,
              }}
            />
            <span
              className="w-full flex-1"
              style={{
                background: `repeating-linear-gradient(to right, transparent 0 3px, ${MARBLE_SHADE} 3px 4px), linear-gradient(to right, ${MARBLE_SHADE} 0%, ${MARBLE_LIGHT} 42%, ${MARBLE_BASE} 78%, ${MARBLE_SHADE} 100%)`,
                opacity: 0.85,
              }}
            />
            <span
              className="h-3 w-full shrink-0"
              style={{
                background: `linear-gradient(to bottom, ${MARBLE_LIGHT}, ${MARBLE_BASE} 55%, ${MARBLE_SHADE})`,
                boxShadow: `0 -1px 0 ${GOLD}`,
              }}
            />
          </span>
        ))}

        {/*
          中身。下揃えで棚台の天面に接地させ、子（アイテム 1 つずつ）に落ち影を持たせる。
          影を器側で一括して掛けるのは、アイテム側の実装に依存せず「載っている」状態を
          保証するため。Rail / EmptyRail のどちらでも同じ深さの階層になる。
        */}
        <div className="relative min-w-0 flex-1 [&>*>*]:drop-shadow-[0_7px_5px_rgba(0,0,0,0.24)]">
          {children}
        </div>
      </div>

      {/* 棚台。壁面より左右へ張り出させ、天面 → 小口 → コーニスの順に組む */}
      <div aria-hidden className="relative -mx-2 sm:-mx-3">
        {/* 天面。上端をいちばん明るくして、光を受けた水平面にする */}
        <div
          className="h-2.5"
          style={{
            background: `linear-gradient(to bottom, ${MARBLE_LIGHT} 0 40%, ${MARBLE_BASE} 100%)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.85)`,
          }}
        />
        {/* 小口。金の細線で天面と分ける */}
        <div
          className="h-2"
          style={{
            background: `linear-gradient(to bottom, ${GOLD} 0 1px, ${MARBLE_BASE} 1px 60%, ${MARBLE_SHADE} 100%)`,
          }}
        />
        {/* コーニス。歯飾り（デンティル）を刻んで、繰形の厚みを出す */}
        <div
          className="h-3 rounded-b-lg"
          style={{
            background: `repeating-linear-gradient(to right, ${MARBLE_SHADE} 0 4px, transparent 4px 10px), linear-gradient(to bottom, ${MARBLE_BASE} 0 55%, ${MARBLE_SHADE} 100%)`,
            boxShadow: '0 9px 14px -9px color-mix(in srgb, var(--foreground) 60%, transparent)',
          }}
        />
      </div>
    </div>
  )
}
