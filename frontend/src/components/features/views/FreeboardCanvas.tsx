'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addViewItem, removeViewItem, updateViewItemPosition } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useUiStore } from '@/stores/ui'
import type { ViewItemPlacement } from '@/types/view'
import type { Item } from '@/types/item'
import { BoardActionsContext, CardNode, CARD_DEFAULT_W, CARD_DEFAULT_H, type CardNodeType } from './CardNode'

const nodeTypes = { card: CardNode }
// カードノードの既定サイズ（中央寄せ計算・未指定サイズのフォールバック）
const CARD_W = CARD_DEFAULT_W
const CARD_H = CARD_DEFAULT_H

function toNode(placement: ViewItemPlacement): CardNodeType {
  return {
    id: placement.item_id,
    type: 'card',
    position: { x: placement.x, y: placement.y },
    data: { item: placement.item },
    width: placement.width ?? CARD_DEFAULT_W,
    height: placement.height ?? CARD_DEFAULT_H,
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
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow()

  const panelMode = useRightPanelStore((s) => s.mode)
  const panelWidth = useUiStore((s) => s.rightPanelWidth)
  const openCard = useRightPanelStore((s) => s.openCard)
  const openBoardCards = useRightPanelStore((s) => s.openBoardCards)
  const openAddCards = useRightPanelStore((s) => s.openAddCards)
  const pendingAddItem = useRightPanelStore((s) => s.pendingAddItem)
  const consumeAdd = useRightPanelStore((s) => s.consumeAdd)
  const focusItemId = useRightPanelStore((s) => s.focusItemId)
  const consumeFocus = useRightPanelStore((s) => s.consumeFocus)

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

  // リサイズ確定時にサイズと座標を保存（左上以外を掴むと位置も動くため x,y も送る）
  const handleResizeEnd = useCallback(
    (itemId: string, size: { x: number; y: number; width: number; height: number }) => {
      updateViewItemPosition(viewId, itemId, {
        x: Math.round(size.x),
        y: Math.round(size.y),
        width: Math.round(size.width),
        height: Math.round(size.height),
      }).catch(() => {})
    },
    [viewId]
  )

  // ダブルクリックで既定サイズに戻す
  const handleNodeDoubleClick: NodeMouseHandler<CardNodeType> = useCallback(
    (_event, node) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === node.id ? { ...n, width: CARD_DEFAULT_W, height: CARD_DEFAULT_H } : n))
      )
      updateViewItemPosition(viewId, node.id, { width: CARD_DEFAULT_W, height: CARD_DEFAULT_H }).catch(() => {})
    },
    [viewId, setNodes]
  )

  // カードクリックで右パネルにそのカードの詳細を開く
  const handleNodeClick: NodeMouseHandler<CardNodeType> = useCallback(
    (_event, node) => {
      openCard(node.id, viewId)
    },
    [openCard, viewId]
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

  // 右パネルの追加操作を消費してボードに配置する
  useEffect(() => {
    if (!pendingAddItem) return
    handleAdd(pendingAddItem)
    consumeAdd()
  }, [pendingAddItem, handleAdd, consumeAdd])

  // 右パネルの一覧クリックを消費して該当カードへパンする
  useEffect(() => {
    if (!focusItemId) return
    const node = nodes.find((n) => n.id === focusItemId)
    if (node) {
      const w = node.width ?? CARD_W
      const h = node.height ?? CARD_H
      setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: getZoom(), duration: 350 })
    }
    consumeFocus()
  }, [focusItemId, nodes, setCenter, getZoom, consumeFocus])

  const boardActions = useMemo(
    () => ({ onRemove: handleRemove, onResizeEnd: handleResizeEnd }),
    [handleRemove, handleResizeEnd]
  )

  return (
    <BoardActionsContext.Provider value={boardActions}>
      <div className="flex flex-col gap-2">
        {/* 上部ツールバー（ボード面を遮らない操作系） */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openAddCards(viewId)} className="flex items-center gap-1">
            <Plus size={15} />
            カードを追加
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBoardCards(viewId)} className="flex items-center gap-1">
            <List size={15} />
            一覧
          </Button>
        </div>

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
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            style={{ backgroundColor: 'transparent' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={2.4} color="#ffffff" />
            <Controls showInteractive={false} />
            {/* 右パネルを開いている間はミニマップをパネル幅ぶん左へ寄せて隠れないようにする */}
            <MiniMap pannable zoomable style={panelMode === 'closed' ? undefined : { right: panelWidth + 12 }} />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">上の「カードを追加」からカードを置いてみましょう。</p>
            </div>
          )}
        </div>
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
