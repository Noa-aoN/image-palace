'use client'

import type { ReactNode } from 'react'
import { useDisplayStyle } from './ShelfBoard'

/**
 * アイテム種別ごとの「器」。棚に並んだときに、形だけで種類が分かる状態を作る。
 *
 * 宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする（= 器を外すと従来の見た目）。
 * 中身（画像・フォールバック）は呼び出し側がそのまま渡す。ここは外側の造作だけを持つ。
 *
 * 種別が増えたらここに 1 分岐足す。装飾は擬似要素ではなく span で組み、
 * 全て pointer-events-none にしてクリック（選択・遷移）を妨げない。
 */
export type EntityKind = 'space' | 'box' | 'deck' | 'board' | 'plate' | 'frame'

// 大理石・金の色味は棚（ShelfBoard）と揃える
const STONE_LIGHT = 'color-mix(in srgb, var(--ivory) 88%, white)'
const STONE_BASE = 'var(--ivory)'
const STONE_SHADE = 'color-mix(in srgb, var(--ivory-dark) 85%, var(--foreground))'
const GOLD = 'color-mix(in srgb, var(--palace) 70%, transparent)'
const GOLD_SOLID = 'var(--palace)'

export function EntityFrame({ kind, children }: { kind: EntityKind; children: ReactNode }) {
  const style = useDisplayStyle()
  if (style === 'simple') return <>{children}</>

  switch (kind) {
    case 'space':
      return <WindowFrame>{children}</WindowFrame>
    case 'box':
      return <ChestFrame>{children}</ChestFrame>
    case 'deck':
      return <DeckFrame>{children}</DeckFrame>
    case 'board':
      return <BoardFrame>{children}</BoardFrame>
    case 'plate':
      return <PlateFrame>{children}</PlateFrame>
    default:
      return <PictureFrame>{children}</PictureFrame>
  }
}

/**
 * スペース＝窓。上辺をアーチで抜き、方立（十字の桟）を渡し、下に石の窓台を置く。
 * 「向こう側に風景が広がっている」ことを、アーチ＋桟＋窓台の 3 点で示す。
 */
function WindowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        className="relative overflow-hidden"
        style={{
          // 上辺のアーチ。角丸ではなく楕円で抜くことで窓に見せる
          borderRadius: '46% 46% 4px 4px / 22% 22% 2px 2px',
          boxShadow: `inset 0 0 0 3px ${STONE_BASE}, inset 0 0 0 4px ${GOLD}`,
        }}
      >
        {children}
        {/* 方立（縦横の桟）。窓ガラスの割りを示す */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2"
          style={{ background: `linear-gradient(to right, ${STONE_SHADE}, ${STONE_LIGHT}, ${STONE_SHADE})`, opacity: 0.9 }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[46%] h-[3px]"
          style={{ background: `linear-gradient(to bottom, ${STONE_LIGHT}, ${STONE_SHADE})`, opacity: 0.9 }}
        />
        {/* ガラスの映り込み。左上から斜めに一筋だけ入れる */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(115deg, rgba(255,255,255,0.28) 0 18%, transparent 34%)',
          }}
        />
      </div>
      {/* 窓台。窓枠より少し張り出させて、壁から出ている厚みを作る */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2"
        style={{
          background: `linear-gradient(to bottom, ${STONE_LIGHT} 0 1px, ${STONE_BASE} 1px 60%, ${STONE_SHADE} 100%)`,
          boxShadow: '0 3px 5px -3px color-mix(in srgb, var(--foreground) 55%, transparent)',
        }}
      />
    </div>
  )
}

/**
 * ボックス＝宝箱。上に蓋の帯、中央に金具（掛け金）、前面が中身の画像。
 * 蓋を閉じた箱を正面から見た状態にして、開けたら中身がある、という含みを持たせる。
 */
function ChestFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {/* 蓋。上端をわずかに丸めて、板ではなく蓋であることを示す */}
      <div
        aria-hidden
        className="relative h-5 rounded-t-md"
        style={{
          background: `linear-gradient(to bottom, ${STONE_LIGHT} 0 2px, ${STONE_BASE} 2px 65%, ${STONE_SHADE} 100%)`,
          boxShadow: `inset 0 0 0 1px ${GOLD}`,
        }}
      >
        {/* 帯金。蓋から前面へ跨がせる */}
        <span
          className="absolute left-1/2 top-1 h-[3px] w-10 -translate-x-1/2 rounded-full"
          style={{ background: GOLD_SOLID, opacity: 0.55 }}
        />
      </div>
      <div className="relative overflow-hidden" style={{ boxShadow: `inset 0 0 0 3px ${STONE_BASE}` }}>
        {children}
        {/* 掛け金。蓋と前面の境目に置いて、閉じている状態を示す */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-4 w-5 -translate-x-1/2 rounded-b-sm"
          style={{
            background: `linear-gradient(to bottom, ${GOLD_SOLID}, color-mix(in srgb, ${GOLD_SOLID} 60%, black))`,
            boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-3 size-1.5 -translate-x-1/2 rounded-full"
          style={{ background: 'color-mix(in srgb, var(--foreground) 70%, transparent)' }}
        />
      </div>
    </div>
  )
}

/** デッキ＝重なった束。背後に 2 枚ずらして置き、厚みのある一組に見せる */
function DeckFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {[2, 1].map((i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-sm border border-border/70"
          style={{
            background: STONE_BASE,
            transform: `translate(${i * 3}px, ${i * -3}px)`,
            opacity: 0.9 - i * 0.2,
          }}
        />
      ))}
      <div className="relative overflow-hidden rounded-sm" style={{ boxShadow: `inset 0 0 0 2px ${STONE_BASE}, 0 1px 3px rgba(0,0,0,0.25)` }}>
        {children}
      </div>
    </div>
  )
}

/** フリーボード＝掲示板。四隅に留め具を置いて、板に留めてある状態にする */
function BoardFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative p-1.5"
      style={{ background: STONE_BASE, boxShadow: `inset 0 0 0 1px ${GOLD}` }}
    >
      <div className="relative overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.28)' }}>
        {children}
      </div>
      {(['left-1 top-1', 'right-1 top-1', 'left-1 bottom-1', 'right-1 bottom-1'] as const).map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`pointer-events-none absolute size-1.5 rounded-full ${pos}`}
          style={{ background: GOLD_SOLID, opacity: 0.75 }}
        />
      ))}
    </div>
  )
}

/** ワードリスト等＝銘板。石板に金線で縁を彫った、文字のための面 */
function PlateFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(to bottom, ${STONE_LIGHT}, ${STONE_BASE})`,
        boxShadow: `inset 0 0 0 1px ${GOLD}, inset 0 0 0 5px ${STONE_BASE}, inset 0 0 0 6px ${GOLD}`,
      }}
    >
      {children}
    </div>
  )
}

/** カード等＝額装。細い金縁と内側のマットで、掛けてある一枚に見せる */
function PictureFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        boxShadow: `inset 0 0 0 2px ${STONE_BASE}, inset 0 0 0 3px ${GOLD}, 0 1px 3px rgba(0,0,0,0.22)`,
      }}
    >
      {children}
    </div>
  )
}
