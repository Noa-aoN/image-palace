'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addViewItem, removeViewItem, updateViewItemPosition } from '@/lib/api/views'
import type { ViewItemPlacement } from '@/types/view'
import type { Item } from '@/types/item'
import { BoardActionsContext, CardNode, type CardNodeType } from './CardNode'
import { AddCardsPanel } from './AddCardsPanel'

const nodeTypes = { card: CardNode }

function toNode(placement: ViewItemPlacement): CardNodeType {
  return {
    id: placement.item_id,
    type: 'card',
    position: { x: placement.x, y: placement.y },
    data: { item: placement.item },
    zIndex: placement.z_index,
  }
}

type FreeboardCanvasProps = {
  viewId: string
  initialItems: ViewItemPlacement[]
}

function Canvas({ viewId, initialItems }: FreeboardCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNodeType>(initialItems.map(toNode))
  const [panelOpen, setPanelOpen] = useState(false)
  const { screenToFlowPosition } = useReactFlow()

  const placedIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])

  const handleRemove = useCallback(
    (itemId: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== itemId))
      removeViewItem(viewId, itemId).catch(() => {})
    },
    [viewId, setNodes]
  )

  // ドラッグ完了時に座標を保存（onNodeDragStop はドラッグ毎に1回だけ発火する）
  const handleDragStop: OnNodeDrag<CardNodeType> = useCallback(
    (_event, node) => {
      updateViewItemPosition(viewId, node.id, {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      }).catch(() => {})
    },
    [viewId]
  )

  const handleAdd = useCallback(
    (item: Item) => {
      if (placedIds.has(item.id)) return
      // 現在のビューポート中央あたりに配置する
      const center =
        typeof window === 'undefined'
          ? { x: 0, y: 0 }
          : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const x = Math.round(center.x)
      const y = Math.round(center.y)

      const placement: ViewItemPlacement = {
        item_id: item.id,
        x,
        y,
        z_index: 0,
        item: { id: item.id, title: item.title, generation_status: item.generation_status, media: item.media },
      }
      setNodes((ns) => [...ns, toNode(placement)])

      addViewItem(viewId, item.id, x, y).catch(() => {
        // 失敗したらロールバック
        setNodes((ns) => ns.filter((n) => n.id !== item.id))
      })
    },
    [viewId, placedIds, screenToFlowPosition, setNodes]
  )

  const boardActions = useMemo(() => ({ onRemove: handleRemove }), [handleRemove])

  return (
    <BoardActionsContext.Provider value={boardActions}>
      <div className="relative flex-1 min-h-[60vh] overflow-hidden rounded-xl border border-border">
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={handleDragStop}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>

        <div className="absolute left-3 top-3 z-10">
          <Button size="sm" onClick={() => setPanelOpen((o) => !o)} className="flex items-center gap-1">
            <Plus size={15} />
            カードを追加
          </Button>
        </div>

        {nodes.length === 0 && !panelOpen && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">「カードを追加」からカードを置いてみましょう。</p>
          </div>
        )}

        {panelOpen && (
          <AddCardsPanel placedIds={placedIds} onAdd={handleAdd} onClose={() => setPanelOpen(false)} />
        )}
      </div>
    </BoardActionsContext.Provider>
  )
}

export function FreeboardCanvas(props: FreeboardCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
