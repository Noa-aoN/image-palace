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

// カード既定サイズ（width/height 未設定時）
export const CARD_DEFAULT_W = 144
export const CARD_DEFAULT_H = 172
const CARD_MIN_W = 96
const CARD_MIN_H = 112

// 接続点（上下左右）。connectionMode=loose なので type は source 固定で双方向に使える。
const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const

export type CardNodeData = {
  item: ViewItemPlacement['item']
}

export type CardNodeType = Node<CardNodeData, 'card'>

function CardNodeComponent({ id, data }: NodeProps<CardNodeType>) {
  const { onRemove, onResizeEnd } = useContext(BoardActionsContext)
  const { item } = data
  const cardFontSize = useBoardSettingsStore((s) => s.settings.card_font_size)
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
          <div
            className="shrink-0 truncate px-2 py-1.5 text-xs font-medium"
            style={cardFontSize ? { fontSize: cardFontSize } : undefined}
          >
            {item.title}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" draggable={false} loading="lazy" />
            ) : (
              <span className="px-2 text-center text-[11px] text-muted-foreground">{item.title}</span>
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
            className="!pointer-events-none !z-10 !h-4 !w-4 !border-2 !border-background !bg-[var(--palace)] !opacity-0 transition-opacity group-hover:!pointer-events-auto group-hover:!opacity-100"
          />
        ))}
      </div>
    </>
  )
}

export const CardNode = memo(CardNodeComponent)
