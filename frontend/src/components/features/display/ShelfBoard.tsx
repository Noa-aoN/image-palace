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
// 光は上から当たる前提で、天面は明るく・前面（木口）はやや暗く・奥は沈める。
const MARBLE_LIGHT = 'color-mix(in srgb, var(--ivory) 88%, white)'
const MARBLE_BASE = 'var(--ivory)'
const MARBLE_SHADE = 'color-mix(in srgb, var(--ivory-dark) 85%, var(--foreground))'
const MARBLE_DEEP = 'color-mix(in srgb, var(--ivory-dark) 70%, var(--foreground))'
const BACK_PANEL = 'color-mix(in srgb, var(--ivory-dark) 86%, var(--foreground))'
const GOLD = 'color-mix(in srgb, var(--palace) 70%, transparent)'
const GOLD_FAINT = 'color-mix(in srgb, var(--palace) 30%, transparent)'

// 内壁の見えている幅。奥行きを表す台形の斜辺はここから引く
const DEPTH = 16

/**
 * 「場」に応じた器。宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする。
 *
 * ライブラリは、壁龕（へきがん）に石の棚板が渡っている構成にしている。
 * 棚に見せる鍵は「アイテムが板の上に載っている」と読めることなので、
 *   - 棚板の *天面* を台形で見せる（奥が狭く手前が広い＝水平面の遠近）
 *   - アイテムを下揃えにし、1 つずつ落ち影を持たせて板に接地させる
 *   - 天面と背板が交わる線を暗くする（接地の暗がり）
 * の 3 点を必ず満たす。前面のモールディングは厚みの表現であって、これ単体では棚にならない。
 *
 * 場が増えても設定は増やさない方針なので、何を出すかはここで場ごとに決める。
 * atelier（制作台）/ study（机）は今後この分岐に足す。
 */
export function SurfaceBoard({ surface, children }: { surface: Surface; children: ReactNode }) {
  const style = useDisplayStyle()

  if (style === 'simple' || surface !== 'library') return <>{children}</>

  // 縦棚を横に並べるときは列いっぱいまで伸ばし、棚板の高さを揃える
  return (
    <div className="relative flex h-full flex-col">
      {/* 壁龕。背板を沈め、天井・内壁・柱で囲んだ箱を作る */}
      <div
        className="relative flex-1 overflow-hidden rounded-t-[10px] px-5 pt-7 sm:px-7"
        style={{
          background: `linear-gradient(to bottom, ${BACK_PANEL} 0%, ${MARBLE_BASE} 55%)`,
          boxShadow: `inset 0 0 0 1px ${GOLD_FAINT}`,
        }}
      >
        {/* 背板の羽目板。細い縦目地を等間隔で入れて、奥に面があることを示す */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `repeating-linear-gradient(to right, transparent 0 43px, ${MARBLE_DEEP} 43px 44px)`,
            opacity: 0.28,
          }}
        />

        {/* 天井面。奥が広く手前が狭い台形＝上から覆いかぶさる面 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-7"
          style={{
            background: `linear-gradient(to bottom, ${MARBLE_DEEP} 0%, transparent 100%)`,
            clipPath: `polygon(0 0, 100% 0, calc(100% - ${DEPTH}px) 100%, ${DEPTH}px 100%)`,
            opacity: 0.75,
          }}
        />

        {/* 左右の内壁。手前へ向かって開く台形で、箱の中を覗いている状態にする */}
        {(['left', 'right'] as const).map((side) => (
          <span
            key={`wall-${side}`}
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 w-5 ${side === 'left' ? 'left-3 sm:left-4' : 'right-3 sm:right-4'}`}
            style={{
              background:
                side === 'left'
                  ? `linear-gradient(to right, ${MARBLE_DEEP}, transparent)`
                  : `linear-gradient(to left, ${MARBLE_DEEP}, transparent)`,
              clipPath:
                side === 'left'
                  ? `polygon(0 0, 100% ${DEPTH}px, 100% 100%, 0 100%)`
                  : `polygon(100% 0, 0 ${DEPTH}px, 0 100%, 100% 100%)`,
              opacity: 0.6,
            }}
          />
        ))}

        {/* 左右の付柱。柱頭・溝彫りの柱身・柱脚の 3 部で構成し、区画として囲む */}
        {(['left', 'right'] as const).map((side) => (
          <span
            key={`pilaster-${side}`}
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 flex w-3 flex-col sm:w-4 ${side === 'left' ? 'left-0' : 'right-0'}`}
          >
            {/* 柱頭 */}
            <span
              className="h-2.5 w-full shrink-0"
              style={{
                background: `linear-gradient(to bottom, ${MARBLE_LIGHT}, ${MARBLE_BASE} 60%, ${MARBLE_SHADE})`,
                boxShadow: `0 1px 0 ${GOLD}`,
              }}
            />
            {/* 柱身。縦の溝彫りで円柱らしい陰影を出す */}
            <span
              className="w-full flex-1"
              style={{
                background: `repeating-linear-gradient(to right, transparent 0 3px, ${MARBLE_SHADE} 3px 4px), linear-gradient(to right, ${MARBLE_SHADE} 0%, ${MARBLE_LIGHT} 42%, ${MARBLE_BASE} 78%, ${MARBLE_SHADE} 100%)`,
              }}
            />
            {/* 柱脚 */}
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
          中身。下揃えにして板へ接地させ、子（アイテム 1 つずつ）に落ち影を持たせる。
          影を器側で一括して掛けるのは、アイテム側の実装に依存せず「載っている」状態を
          保証するため。Rail / EmptyRail のどちらでも同じ深さの階層になる。
        */}
        <div className="relative flex items-end [&>*>*]:drop-shadow-[0_6px_5px_rgba(0,0,0,0.22)]">
          <div className="min-w-0 flex-1">{children}</div>
        </div>

        {/* 棚板の天面。奥が狭く手前が広い台形＝水平面の遠近。これが「載っている」根拠になる */}
        <span
          aria-hidden
          className="pointer-events-none relative -mx-5 mt-1 block h-3.5 sm:-mx-7"
          style={{
            background: `linear-gradient(to bottom, ${MARBLE_SHADE} 0%, ${MARBLE_BASE} 45%, ${MARBLE_LIGHT} 100%)`,
            clipPath: `polygon(${DEPTH}px 0, calc(100% - ${DEPTH}px) 0, 100% 100%, 0 100%)`,
          }}
        />

        {/* 接地の暗がり。天面と背板が交わる線に沿って落とすと、面の折れ目が立つ */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-5 bottom-3 h-2 blur-[3px] sm:inset-x-7"
          style={{ background: `linear-gradient(to top, ${MARBLE_DEEP}, transparent)`, opacity: 0.55 }}
        />
      </div>

      {/* 棚板の前面（木口）。段を重ねたモールディングで厚みを出し、金の細線で縁取る */}
      <div
        aria-hidden
        className="relative -mx-1 h-3 rounded-b-[10px] sm:h-3.5"
        style={{
          background: `linear-gradient(to bottom, ${MARBLE_LIGHT} 0 1px, ${GOLD} 1px 2px, ${MARBLE_BASE} 2px 40%, ${MARBLE_SHADE} 40% 46%, ${MARBLE_BASE} 46% 82%, ${MARBLE_SHADE} 100%)`,
          boxShadow: '0 8px 14px -8px color-mix(in srgb, var(--foreground) 60%, transparent)',
        }}
      />
    </div>
  )
}
