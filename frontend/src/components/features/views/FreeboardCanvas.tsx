'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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
// カードノードのおおよそのサイズ（中央寄せ計算用）
const CARD_W = 144
const CARD_H = 172

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
  const boardRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNodeType>(initialItems.map(toNode))
  const [panelOpen, setPanelOpen] = useState(false)
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow()

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

      // 表示中のボード中央の座標に置く（ボード要素の中心 → フロー座標）
      const rect = boardRef.current?.getBoundingClientRect()
      const screenCenter = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const flow = screenToFlowPosition(screenCenter)
      // 連続追加で完全に重ならないよう少しずつずらす
      const offset = (nodes.length % 6) * 26
      const x = Math.round(flow.x - CARD_W / 2 + offset)
      const y = Math.round(flow.y - CARD_H / 2 + offset)

      const placement: ViewItemPlacement = {
        item_id: item.id,
        x,
        y,
        z_index: 0,
        item: { id: item.id, title: item.title, generation_status: item.generation_status, media: item.media },
      }
      setNodes((ns) => [...ns, toNode(placement)])
      // 追加したカードへパンして必ず見えるようにする
      setCenter(x + CARD_W / 2, y + CARD_H / 2, { zoom: getZoom(), duration: 350 })

      addViewItem(viewId, item.id, x, y).catch(() => {
        // 失敗したらロールバック
        setNodes((ns) => ns.filter((n) => n.id !== item.id))
      })
    },
    [viewId, placedIds, nodes.length, screenToFlowPosition, setCenter, getZoom, setNodes]
  )

  const boardActions = useMemo(() => ({ onRemove: handleRemove }), [handleRemove])

  return (
    <BoardActionsContext.Provider value={boardActions}>
      <div
        ref={boardRef}
        className="relative h-[72vh] w-full overflow-hidden rounded-xl border border-border"
        style={{ backgroundColor: 'var(--ivory-dark)' }}
      >
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
          style={{ backgroundColor: 'transparent' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={2.4} color="#ffffff" />
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
