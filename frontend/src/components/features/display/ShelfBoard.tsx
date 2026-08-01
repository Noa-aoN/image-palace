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
// 光は上から当たる前提で、天面は明るく・前面（木口）はやや暗く・ニッチは沈める。
const MARBLE_LIGHT = 'color-mix(in srgb, var(--ivory) 88%, white)'
const MARBLE_BASE = 'var(--ivory)'
const MARBLE_SHADE = 'color-mix(in srgb, var(--ivory-dark) 85%, var(--foreground))'
const NICHE = 'color-mix(in srgb, var(--ivory-dark) 88%, var(--foreground))'
const GOLD_LINE = 'color-mix(in srgb, var(--palace) 70%, transparent)'

/**
 * 「場」に応じた器。宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする。
 *
 * ライブラリは大理石のニッチ（窪み）に石の棚板が渡っている、という構成にしている。
 * 板を 1 枚敷くだけでは棚に見えないため、
 *   - 背面を一段沈めて窪みを作る（上端に落ち影）
 *   - 左右に柱を立てて区画として囲む
 *   - 棚板は天面・前面・下端の 3 面で厚みを出し、金の細線で縁取る
 * の 3 点で「石の棚に納まっている」状態を作る。
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
      {/* ニッチ（窪み）。背面を沈め、上端の落ち影で奥行きを出す */}
      <div
        className="relative flex-1 rounded-t-lg px-4 pb-5 pt-4 sm:px-6"
        style={{
          background: `linear-gradient(to bottom, ${NICHE} 0%, ${MARBLE_BASE} 42%)`,
          boxShadow:
            'inset 0 10px 14px -10px color-mix(in srgb, var(--foreground) 70%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--palace) 18%, transparent)',
        }}
      >
        {/* 左右の柱。区画として囲むことで棚だと分かる */}
        {(['left', 'right'] as const).map((side) => (
          <span
            key={side}
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 w-2.5 sm:w-3.5 ${
              side === 'left' ? 'left-0 rounded-tl-lg' : 'right-0 rounded-tr-lg'
            }`}
            style={{
              background:
                side === 'left'
                  ? `linear-gradient(to right, ${MARBLE_SHADE}, ${MARBLE_LIGHT} 45%, ${MARBLE_BASE})`
                  : `linear-gradient(to left, ${MARBLE_SHADE}, ${MARBLE_LIGHT} 45%, ${MARBLE_BASE})`,
              boxShadow: `inset 0 0 0 1px ${GOLD_LINE}`,
            }}
          />
        ))}

        {/* 奥行き。上面と左右の内壁を斜めに見せ、箱の中を覗いている状態を作る */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-6"
          style={{
            background: `linear-gradient(to bottom, ${MARBLE_SHADE} 0%, transparent 100%)`,
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 14px 100%)',
            opacity: 0.55,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-2.5 w-3.5 sm:left-3.5"
          style={{
            background: `linear-gradient(to right, ${MARBLE_SHADE}, transparent)`,
            clipPath: 'polygon(0 0, 100% 14px, 100% calc(100% - 14px), 0 100%)',
            opacity: 0.5,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-2.5 w-3.5 sm:right-3.5"
          style={{
            background: `linear-gradient(to left, ${MARBLE_SHADE}, transparent)`,
            clipPath: 'polygon(100% 0, 0 14px, 0 calc(100% - 14px), 100% 100%)',
            opacity: 0.5,
          }}
        />

        {/* 中身。棚板の上に置かれているように、下に接地影を落とす */}
        <div className="relative px-1">
          {children}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 -bottom-3 h-3 rounded-[50%] blur-[4px]"
            style={{ background: 'color-mix(in srgb, var(--foreground) 26%, transparent)' }}
          />
        </div>
      </div>

      {/* 石の棚板。天面（明）→ 前面（基調）→ 下端（影）で厚みを作り、金線で縁取る */}
      <div
        aria-hidden
        className="relative h-4 rounded-b-lg sm:h-5"
        style={{
          background: `linear-gradient(to bottom, ${MARBLE_LIGHT} 0 2px, ${GOLD_LINE} 2px 3px, ${MARBLE_BASE} 3px 70%, ${MARBLE_SHADE} 100%)`,
          boxShadow: '0 6px 12px -6px color-mix(in srgb, var(--foreground) 50%, transparent)',
        }}
      />
    </div>
  )
}
