'use client'

import { createContext, memo, useContext } from 'react'
import { X } from 'lucide-react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ViewItemPlacement } from '@/types/view'

// ノード data に関数を入れると render 中の ref 参照になり lint に触れるため、
// 削除ハンドラは Context 経由で渡す。
export const BoardActionsContext = createContext<{ onRemove: (itemId: string) => void }>({
  onRemove: () => {},
})

export type CardNodeData = {
  item: ViewItemPlacement['item']
}

export type CardNodeType = Node<CardNodeData, 'card'>

function CardNodeComponent({ id, data }: NodeProps<CardNodeType>) {
  const { onRemove } = useContext(BoardActionsContext)
  const { item } = data
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null

  return (
    <div className="group relative w-36 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" draggable={false} loading="lazy" />
        ) : (
          <span className="px-2 text-center text-[11px] text-muted-foreground">{item.title}</span>
        )}
      </div>
      <div className="truncate px-2 py-1.5 text-xs font-medium">{item.title}</div>
    </div>
  )
}

export const CardNode = memo(CardNodeComponent)
