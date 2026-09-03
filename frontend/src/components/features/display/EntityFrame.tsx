'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useDisplayStyle } from './ShelfBoard'

/**
 * 器の中にいるかどうか。器が縁取りを持つので、画像側のマット（内側の余白）は外す。
 * 表示側（EntityCover）が自分で判断できるようにするための伝達路。
 */
const FramedContext = createContext(false)

/** 器の中に描かれているか。true のとき画像はマット無しで縁いっぱいに出す */
export function useInEntityFrame() {
  return useContext(FramedContext)
}

/**
 * アイテム種別ごとの「器」。棚に並んだときに、形だけで種類が分かる状態を作る。
 *
 * 宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする（= 器を外すと従来の見た目）。
 * 中身（画像・フォールバック）は呼び出し側がそのまま渡す。ここは外側の造作だけを持つ。
 *
 * 種別が増えたらここに 1 分岐足す。装飾は擬似要素ではなく span で組み、
 * 全て pointer-events-none にしてクリック（選択・遷移）を妨げない。
 */
export type EntityKind = 'space' | 'road' | 'box' | 'deck' | 'board' | 'mineral' | 'frame'

// 大理石・金の色味は棚（ShelfBoard）と揃える
const STONE_LIGHT = 'color-mix(in srgb, var(--ivory) 88%, white)'
const STONE_BASE = 'var(--ivory)'
const STONE_SHADE = 'color-mix(in srgb, var(--ivory-dark) 85%, var(--foreground))'
const GOLD = 'color-mix(in srgb, var(--palace) 70%, transparent)'
const GOLD_SOLID = 'var(--palace)'

export function EntityFrame({ kind, children: raw }: { kind: EntityKind; children: ReactNode }) {
  const style = useDisplayStyle()
  if (style === 'simple') return <>{raw}</>

  // 器が縁を持つ種別は、中の画像をマット無しで描かせる。
  // デッキはカードの束なので、カードと同じ画像マットを残す（束ねた 1 枚に見せるため）。
  const children =
    kind === 'deck' ? raw : <FramedContext.Provider value>{raw}</FramedContext.Provider>

  switch (kind) {
    case 'space':
      return <DoorFrame>{children}</DoorFrame>
    case 'road':
      return <WindowFrame open>{children}</WindowFrame>
    case 'box':
      return <ChestFrame>{children}</ChestFrame>
    case 'deck':
      return <DeckFrame>{children}</DeckFrame>
    case 'board':
      return <BoardFrame>{children}</BoardFrame>
    case 'mineral':
      return <MineralFrame>{children}</MineralFrame>
    default:
      return <PictureFrame>{children}</PictureFrame>
  }
}

/**
 * ルーム＝扉。入って中を歩く場所なので、覗く窓ではなく通り抜ける開口として描く。
 *
 * 楣（まぐさ）・左右の方立・下の沓摺で枠を作り、内側を扉の面にする。
 * 中身の画像は扉の向こうに見える部屋として扱い、把手を添えて開くものだと示す。
 */
function DoorFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        className="relative overflow-hidden"
        style={{
          // 上辺だけをわずかに丸めた縦長の開口。窓のアーチより浅くする
          borderRadius: '10% 10% 2px 2px / 6% 6% 2px 2px',
          boxShadow: `inset 0 0 0 4px ${STONE_BASE}, inset 0 0 0 5px ${GOLD}`,
        }}
      >
        {children}
        {/* 楣。開口の上に一本渡して、扉の枠であることを示す */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[7%]"
          style={{ background: `linear-gradient(to bottom, ${STONE_LIGHT}, ${STONE_SHADE})` }}
        />
        {/* 把手。開く側（右）の中ほどに置く */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-[8%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
          style={{ background: GOLD_SOLID, boxShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
        />
        {/* 内側の陰。開口の縁に沿って落とし、奥に空間があることを示す */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: `inset 0 14px 18px -14px rgba(0,0,0,0.55), inset 14px 0 18px -14px rgba(0,0,0,0.4)`,
          }}
        />
      </div>
      {/* 沓摺。またいで入る段差 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5"
        style={{
          background: `linear-gradient(to bottom, ${STONE_LIGHT} 0 1px, ${STONE_BASE} 1px 60%, ${STONE_SHADE} 100%)`,
          boxShadow: '0 2px 4px -2px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  )
}

/**
 * スペース＝窓。上辺をアーチで抜き、方立（十字の桟）を渡し、下に石の窓台を置く。
 * 「向こう側に風景が広がっている」ことを、アーチ＋桟＋窓台の 3 点で示す。
 */
function WindowFrame({ children, open = false }: { children: ReactNode; open?: boolean }) {
  return (
    <div className="relative">
      <div
        className="relative overflow-hidden"
        style={{
          // 上辺のアーチ。角丸ではなく楕円で抜くことで窓に見せる
          borderRadius: open ? '50% 50% 3px 3px / 30% 30% 2px 2px' : '46% 46% 4px 4px / 22% 22% 2px 2px',
          boxShadow: `inset 0 0 0 3px ${STONE_BASE}, inset 0 0 0 4px ${GOLD}`,
        }}
      >
        {children}
        {/* 方立（縦横の桟）。窓ガラスの割りを示す */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 ${open ? 'w-[2px] opacity-60' : 'w-[3px]'}`}
          style={{ background: `linear-gradient(to right, ${STONE_SHADE}, ${STONE_LIGHT}, ${STONE_SHADE})` }}
        />
        {/* 横桟。ルームは窓として割るが、ロードは道が奥へ抜けるので入れない */}
        {!open && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[46%] h-[3px]"
            style={{ background: `linear-gradient(to bottom, ${STONE_LIGHT}, ${STONE_SHADE})`, opacity: 0.9 }}
          />
        )}
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
 * ボックス＝大理石の櫃（ひつ）。段になった蓋、角の付柱、正面のメダリオン、台座で組む。
 *
 * 中身の画像は「箱の正面に嵌められた飾り」として円形に嵌め込む。
 * 箱そのものを石として描き、画像を額装された意匠として扱うことで、
 * どんな画像が入っても宮殿の収蔵箱として成立する。
 */
function ChestFrame({ children }: { children: ReactNode }) {
  return (
    <div className="group/chest relative pt-1.5">
      {/*
        蓋。天面を台形で見せて「上から開く箱」と読めるようにする。
        合わせ目の陰で本体と分かれていることを示し、ホバーで少し持ち上げて開くことを伝える。
      */}
      <span
        aria-hidden
        className="relative z-10 block transition-transform duration-200 ease-out group-hover/chest:-translate-y-1"
      >
        {/* 天面。奥が狭く手前が広い台形＝上から見えている水平面 */}
        <span
          className="mx-auto block h-2.5 w-[92%]"
          style={{
            clipPath: 'polygon(7% 0, 93% 0, 100% 100%, 0 100%)',
            background: `linear-gradient(to bottom, ${STONE_SHADE} 0%, ${STONE_LIGHT} 55%, ${STONE_LIGHT} 100%)`,
          }}
        />
        {/* 蓋の小口。金の細線で天面と分ける */}
        <span
          className="mx-auto block h-2 w-[94%]"
          style={{
            background: `linear-gradient(to bottom, ${GOLD} 0 1px, ${STONE_BASE} 1px 60%, ${STONE_SHADE} 100%)`,
          }}
        />
        {/* 掛け金。正面中央に置いて、ここが開くことを示す */}
        <span
          className="absolute bottom-0 left-1/2 h-3 w-4 -translate-x-1/2 translate-y-1/3 rounded-b-[2px]"
          style={{
            background: `linear-gradient(to bottom, ${GOLD_SOLID}, color-mix(in srgb, ${GOLD_SOLID} 55%, black))`,
            boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        />
      </span>

      {/* 合わせ目。蓋と本体の境に陰を落とし、別の部材であることを示す */}
      <span
        aria-hidden
        className="mx-auto block h-[3px] w-[96%]"
        style={{ background: `linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 45%, transparent), transparent)` }}
      />

      {/* 本体。正面にメダリオン、左右角に付柱 */}
      <div
        className="relative flex aspect-[7/5] w-full items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${STONE_LIGHT} 0%, ${STONE_BASE} 55%, ${STONE_SHADE} 100%)`,
          boxShadow: `inset 0 1px 0 ${STONE_LIGHT}, inset 0 -6px 10px -8px color-mix(in srgb, var(--foreground) 60%, transparent)`,
        }}
      >
        {/* 角の付柱。柱頭・柱脚に金の帯を入れて、箱の稜線を締める */}
        {(['left', 'right'] as const).map((side) => (
          <span
            key={side}
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 w-2.5 ${side === 'left' ? 'left-0' : 'right-0'}`}
            style={{
              background: `linear-gradient(to right, ${STONE_SHADE} 0%, ${STONE_LIGHT} 45%, ${STONE_BASE} 100%)`,
              boxShadow: `inset 0 3px 0 ${GOLD}, inset 0 -3px 0 ${GOLD}`,
              transform: side === 'right' ? 'scaleX(-1)' : undefined,
            }}
          />
        ))}

        {/* メダリオン。二重の金環で縁取った円の中に中身を嵌める */}
        <span
          className="relative block w-[58%] overflow-hidden rounded-full"
          style={{ boxShadow: `0 2px 6px -2px rgba(0,0,0,0.45)` }}
        >
          {children}
          {/* 金環は画像の *上* に被せる。外側に置くと画像との間に隙間が見えるため */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: `inset 0 0 0 2px ${GOLD_SOLID}, inset 0 0 0 4px ${STONE_BASE}, inset 0 0 0 5px ${GOLD}` }}
          />
        </span>
      </div>

      {/* 台座。本体より広い 2 段で受けて、床に据わった箱にする */}
      <div
        aria-hidden
        className="mx-auto h-1.5 w-[98%]"
        style={{ background: `linear-gradient(to bottom, ${STONE_LIGHT} 0 1px, ${STONE_BASE} 1px 100%)` }}
      />
      <div
        aria-hidden
        className="mx-auto h-2 w-[92%] rounded-b-[3px]"
        style={{ background: `linear-gradient(to bottom, ${STONE_BASE}, ${STONE_SHADE})`, boxShadow: `0 0 0 1px ${GOLD}` }}
      />
    </div>
  )
}

/**
 * デッキ＝重なった札束。背後に数枚ずらして重ね、上端に小口を見せて厚みを出す。
 * 中身はカードと同じマット付きで描くので、束のいちばん上の 1 枚として読める。
 */
function DeckFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative pb-1.5 pr-1.5">
      {/* 背後の札。奥ほど小さく暗く、わずかに傾けて手で重ねた束にする */}
      {[3, 2, 1].map((i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[3px] border border-border/60"
          style={{
            background: `linear-gradient(to bottom, ${STONE_LIGHT}, ${STONE_BASE})`,
            transform: `translate(${i * 2}px, ${i * 2}px) rotate(${i % 2 ? 0.6 : -0.5}deg)`,
            opacity: 1 - i * 0.12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
          }}
        />
      ))}
      {/* いちばん上の 1 枚 */}
      <div
        className="relative overflow-hidden rounded-[3px]"
        style={{ boxShadow: `inset 0 0 0 1px ${GOLD}, 0 2px 5px -1px rgba(0,0,0,0.3)` }}
      >
        {children}
      </div>
    </div>
  )
}

/** ボード＝公示板。四隅に留め具を置いて、板に留めてある状態にする */
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

/**
 * マテリアル＝鉱物。まだ加工されていない素材なので、原石の割れ面として描く。
 * 角を落とした多角形に切り、面ごとに光の当たり方を変えて結晶らしい稜線を出す。
 */
function MineralFrame({ children }: { children: ReactNode }) {
  // 正六角形。素材＝まだ組み合わされていない単位、という含みでハニカムにする
  const hex = 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)'
  return (
    <div className="relative">
      <div className="relative overflow-hidden" style={{ clipPath: hex, background: STONE_BASE }}>
        {children}
        {/* 縁だけ石で締める。面の中は割らない */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: hex, boxShadow: `inset 0 0 0 3px ${STONE_BASE}, inset 0 0 0 4px ${GOLD}` }}
        />
      </div>
      {/* 影。塊が面に置かれている状態にする */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-0 h-1.5 rounded-[50%] blur-[3px]"
        style={{ background: 'color-mix(in srgb, var(--foreground) 28%, transparent)' }}
      />
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
