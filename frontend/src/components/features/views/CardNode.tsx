'use client'

import { createContext, memo, useContext } from 'react'
import { X } from 'lucide-react'
import { NodeResizer, Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import type { ViewItemPlacement } from '@/types/view'

// ノード data に関数を入れると render 中の ref 参照になり lint に触れるため、
// 削除・リサイズのハンドラは Context 経由で渡す。
export const BoardActionsContext = createContext<{
  onRemove: (itemId: string) => void
  onResizeEnd: (itemId: string, size: { x: number; y: number; width: number; height: number }) => void
}>({
  onRemove: () => {},
  onResizeEnd: () => {},
})

// 見出しの行は高さを固定する。文字サイズを変えたときに行が伸び縮みすると、
// 下の画像の領域が押されて正方形でなくなるため
export const CARD_TITLE_H = 32
// 見出しの既定の文字サイズ
export const DEFAULT_CARD_FONT_SIZE = 15
// カード既定サイズ（width/height 未設定時）。画像を正方形に保つため 幅 + 見出しの行
export const CARD_DEFAULT_W = 144
export const CARD_DEFAULT_H = CARD_DEFAULT_W + CARD_TITLE_H
const CARD_MIN_W = 96
const CARD_MIN_H = CARD_MIN_W + CARD_TITLE_H

// 接続点（上下左右）。connectionMode=loose なので type は source 固定で双方向に使える。
/**
 * 線を掴める点。**1辺につき3つ。**
 *
 * 辺の真ん中に1点だけだった頃は、手で引く線がどれも同じ点から出るので、
 * つながりが増えるほど根元が束になって読めなくなっていた。
 *
 * 真ん中（index 2）だけは、**昔からの名前 `top` のまま**にしてある。
 * 名前を変えると、いま引かれている線の端点が読めなくなる。
 *
 * 位置は (index + 1) / 4。端に寄せすぎると角から線が出て、
 * どちらの辺の線か読めなくなる（サーバーの Layout::Handles と揃えること）
 */
const POINTS_PER_SIDE = 3
const CENTER_INDEX = 1

const SIDES = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
] as const

const HANDLES = SIDES.flatMap(({ side, position }) =>
  Array.from({ length: POINTS_PER_SIDE }, (_, index) => {
    const along = `${((index + 1) / (POINTS_PER_SIDE + 1)) * 100}%`
    const vertical = side === 'left' || side === 'right'
    return {
      id: index === CENTER_INDEX ? side : `${side}-${index}`,
      position,
      // 真ん中は React Flow の既定位置に任せる（ずらすと1pxずれる）
      style: index === CENTER_INDEX ? undefined : vertical ? { top: along } : { left: along },
    }
  })
)

export type CardNodeData = {
  item: ViewItemPlacement['item']
}

export type CardNodeType = Node<CardNodeData, 'card'>

function CardNodeComponent({ id, data }: NodeProps<CardNodeType>) {
  const { onRemove, onResizeEnd } = useContext(BoardActionsContext)
  const { item } = data
  const cardFontSize = useBoardSettingsStore((s) => s.settings.card_font_size)
  // 全景を収める設定のときは切り取らない（縦横比が違っても見えている範囲が揃う）
  // 既定は全景。切り取ると、縦横比の違うカードで見えている範囲がまちまちになる
  const imageFit = useBoardSettingsStore((s) => s.settings.card_image_fit) ?? 'contain'
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null

  return (
    <>
      {/* リサイズハンドルは常時レンダリングし、表示/操作はホバー・選択時のみ（globals.css で制御）。
          縦横比は既定比を維持。確定時にサイズ（＋左上基点で位置も）を保存する。 */}
      <NodeResizer
        isVisible
        keepAspectRatio
        minWidth={CARD_MIN_W}
        minHeight={CARD_MIN_H}
        onResizeEnd={(_event, params) =>
          onResizeEnd(id, { x: params.x, y: params.y, width: params.width, height: params.height })
        }
      />
      {/* overflow-hidden の内側だと接続ハンドルが切れるため、group ラッパの直下に置く */}
      <div className="group relative h-full w-full">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(id)
            }}
            aria-label="ボードから外す"
            className="nodrag nopan absolute right-1 top-1 z-10 hidden rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-black/75 group-hover:flex"
          >
            <X size={13} />
          </button>
          {/* 高さを固定して、文字サイズを変えても下の画像に影響しないようにする */}
          <div
            className="flex shrink-0 items-center overflow-hidden px-2 font-medium leading-none"
            style={{ height: CARD_TITLE_H, fontSize: cardFontSize ?? DEFAULT_CARD_FONT_SIZE }}
          >
            <span className="truncate" title={item.title}>{item.title}</span>
          </div>
          <div className="flex aspect-square min-h-0 w-full items-center justify-center overflow-hidden bg-muted">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={item.title}
                className={`h-full w-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                draggable={false}
                loading="lazy"
              />
            ) : (
              <span className="px-2 text-center text-2xs text-muted-foreground">{item.title}</span>
            )}
          </div>
        </div>
        {/* 接続ハンドル（ホバーで表示）。掴みやすいよう大きめにする */}
        {HANDLES.map((h) => (
          <Handle
            key={h.id}
            id={h.id}
            type="source"
            position={h.position}
            style={h.style}
            /* 3つ並ぶので、少し小さくする。掴むのはホバー中だけなので、
               近づいたときに大きくして掴みやすさを戻す */
            className="!pointer-events-none !z-10 !h-3 !w-3 !border-2 !border-background !bg-[var(--palace)] !opacity-0 transition-all group-hover:!pointer-events-auto group-hover:!opacity-100 hover:!h-4 hover:!w-4"
          />
        ))}
      </div>
    </>
  )
}

export const CardNode = memo(CardNodeComponent)
