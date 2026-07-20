'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  MarkerType,
  type OnNodeDrag,
  type NodeMouseHandler,
  type OnConnect,
  type EdgeMouseHandler,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, List, Spline, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addViewItem, removeViewItem, updateViewItemPosition, addViewEdge, updateViewEdge, removeViewEdge } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useUiStore } from '@/stores/ui'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import type { ViewItemPlacement, ViewEdge, ViewEdgeStyle, EdgePoint } from '@/types/view'
import type { Item } from '@/types/item'
import { BoardActionsContext, CardNode, CARD_DEFAULT_W, CARD_DEFAULT_H, type CardNodeType } from './CardNode'
import { EditableEdge, EdgeActionsContext } from './EditableEdge'

const nodeTypes = { card: CardNode }
const edgeTypes = { editable: EditableEdge }
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

type EdgeData = { edgeStyle: ViewEdgeStyle; label: string | null; points: EdgePoint[] }

// 正規のスタイル(ViewEdgeStyle)から React Flow のパス描画プロパティ（stroke/矢印）を作る。
// ラベルはカスタム edge(EditableEdge) が data から HTML で描画するため、ここでは扱わない。
function edgeVisuals(style: ViewEdgeStyle | null | undefined) {
  const s = style ?? {}
  const lineOpacity = s.opacity != null ? s.opacity / 100 : undefined
  // 既定の線・矢印は黒（濃色）。color を常に確定させることで矢印の塗りも消えない。
  const strokeColor = s.color || '#1a1a1a'
  const arrow = { type: MarkerType.ArrowClosed, color: strokeColor }
  // 既定は終端=矢印・始端=なし。設定で 'none' / 'arrow' を切替。
  const markerStart = (s.marker_start ?? 'none') === 'arrow' ? arrow : undefined
  const markerEnd = (s.marker_end ?? 'arrow') === 'arrow' ? arrow : undefined
  return {
    markerStart,
    markerEnd,
    style: {
      stroke: strokeColor,
      strokeWidth: s.width || undefined,
      strokeDasharray: s.dashed ? '6 4' : undefined,
      opacity: lineOpacity,
    },
  }
}

// ViewEdge(サーバ) → React Flow の Edge
function viewToEdge(e: ViewEdge): Edge {
  const style = e.style ?? {}
  const label = e.label ?? null
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.source_handle ?? undefined,
    targetHandle: e.target_handle ?? undefined,
    type: 'editable',
    data: { edgeStyle: style, label, points: e.points ?? [] } satisfies EdgeData,
    ...edgeVisuals(style),
  }
}

// React Flow の Edge → ViewEdge スナップショット（右パネル編集用）。正本は data から取る。
function edgeToView(e: Edge): ViewEdge {
  const d = (e.data ?? {}) as Partial<EdgeData>
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    source_handle: e.sourceHandle ?? null,
    target_handle: e.targetHandle ?? null,
    label: d.label ?? (typeof e.label === 'string' ? e.label : null),
    style: d.edgeStyle ?? {},
    points: d.points ?? null,
  }
}

type FreeboardCanvasProps = {
  viewId: string
  initialItems: ViewItemPlacement[]
  initialEdges: ViewEdge[]
}

function Canvas({ viewId, initialItems, initialEdges }: FreeboardCanvasProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNodeType>(initialItems.map(toNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges.map(viewToEdge))
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow()

  const panelMode = useRightPanelStore((s) => s.mode)
  const panelWidth = useUiStore((s) => s.rightPanelWidth)
  const openCard = useRightPanelStore((s) => s.openCard)
  const openBoardCards = useRightPanelStore((s) => s.openBoardCards)
  const openAddCards = useRightPanelStore((s) => s.openAddCards)
  const openBoardObjects = useRightPanelStore((s) => s.openBoardObjects)
  const openBoardSettings = useRightPanelStore((s) => s.openBoardSettings)
  const boardSettings = useBoardSettingsStore((s) => s.settings)
  const backgroundImageUrl = useBoardSettingsStore((s) => s.backgroundImageUrl)
  const openEdge = useRightPanelStore((s) => s.openEdge)
  const pendingAddItem = useRightPanelStore((s) => s.pendingAddItem)
  const consumeAdd = useRightPanelStore((s) => s.consumeAdd)
  const focusItemId = useRightPanelStore((s) => s.focusItemId)
  const consumeFocus = useRightPanelStore((s) => s.consumeFocus)
  const focusEdgeId = useRightPanelStore((s) => s.focusEdgeId)
  const consumeFocusEdge = useRightPanelStore((s) => s.consumeFocusEdge)
  const edgePatch = useRightPanelStore((s) => s.edgePatch)
  const consumeEdgePatch = useRightPanelStore((s) => s.consumeEdgePatch)
  const edgeRemoveId = useRightPanelStore((s) => s.edgeRemoveId)
  const consumeEdgeRemove = useRightPanelStore((s) => s.consumeEdgeRemove)

  const placedIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])

  const handleRemove = useCallback(
    (itemId: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== itemId))
      // そのカードを端点に持つ接続線もローカルから除去（サーバ側は remove_item が掃除する）
      setEdges((es) => es.filter((e) => e.source !== itemId && e.target !== itemId))
      removeViewItem(viewId, itemId).catch(() => {})
    },
    [viewId, setNodes, setEdges]
  )

  // ドラッグ完了時に座標を保存
  const handleDragStop: OnNodeDrag<CardNodeType> = useCallback(
    (_event, node) => {
      updateViewItemPosition(viewId, node.id, {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      }).catch(() => {})
    },
    [viewId]
  )

  // リサイズ確定時にサイズと座標を保存
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

  // カードクリックで右パネルに詳細を開く
  const handleNodeClick: NodeMouseHandler<CardNodeType> = useCallback(
    (_event, node) => {
      openCard(node.id, viewId)
    },
    [openCard, viewId]
  )

  // ハンドルをドラッグして接続線を作る
  const handleConnect: OnConnect = useCallback(
    (conn) => {
      if (!conn.source || !conn.target) return
      const tempId = `tmp-${crypto.randomUUID()}`
      const newEdge: Edge = {
        id: tempId,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
        type: 'editable',
        data: { edgeStyle: {}, label: null, points: [] } satisfies EdgeData,
        ...edgeVisuals({}),
      }
      setEdges((es) => addEdge(newEdge, es))
      addViewEdge(viewId, {
        source_node_id: conn.source,
        target_node_id: conn.target,
        source_handle: conn.sourceHandle,
        target_handle: conn.targetHandle,
      })
        .then((saved) => setEdges((es) => es.map((e) => (e.id === tempId ? { ...e, id: saved.id } : e))))
        .catch(() => setEdges((es) => es.filter((e) => e.id !== tempId)))
    },
    [viewId, setEdges]
  )

  // 選択＋Delete で接続線を削除
  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((e) => {
        if (!e.id.startsWith('tmp-')) removeViewEdge(viewId, e.id).catch(() => {})
      })
    },
    [viewId]
  )

  // 接続線クリックで右パネルの編集を開く
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      openEdge(viewId, edgeToView(edge))
    },
    [openEdge, viewId]
  )

  const handleAdd = useCallback(
    (item: Item) => {
      if (placedIds.has(item.id)) return

      const rect = boardRef.current?.getBoundingClientRect()
      const screenCenter = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const flow = screenToFlowPosition(screenCenter)
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
      setCenter(x + CARD_W / 2, y + CARD_H / 2, { zoom: getZoom(), duration: 350 })

      addViewItem(viewId, item.id, x, y).catch(() => {
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

  // オブジェクト一覧の接続線クリックを消費して、その線（端点ノードの中点）へパンする
  useEffect(() => {
    if (!focusEdgeId) return
    const edge = edges.find((e) => e.id === focusEdgeId)
    const src = edge && nodes.find((n) => n.id === edge.source)
    const tgt = edge && nodes.find((n) => n.id === edge.target)
    if (src && tgt) {
      const cx = (n: (typeof nodes)[number]) => n.position.x + (n.width ?? CARD_W) / 2
      const cy = (n: (typeof nodes)[number]) => n.position.y + (n.height ?? CARD_H) / 2
      setCenter((cx(src) + cx(tgt)) / 2, (cy(src) + cy(tgt)) / 2, { zoom: getZoom(), duration: 350 })
    }
    consumeFocusEdge()
  }, [focusEdgeId, edges, nodes, setCenter, getZoom, consumeFocusEdge])

  // 右パネルでの接続線編集を消費して線を更新する
  useEffect(() => {
    if (!edgePatch) return
    const { id, changes } = edgePatch
    setEdges((es) =>
      es.map((e) => {
        if (e.id !== id) return e
        const prev = (e.data ?? {}) as Partial<EdgeData>
        const nextStyle = changes.style !== undefined ? (changes.style ?? {}) : (prev.edgeStyle ?? {})
        const nextLabel = changes.label !== undefined ? (changes.label ?? null) : (prev.label ?? null)
        // points は必ず引き継ぐ（変更が来たときだけ差し替え）。落とすと色変更等で折れ点が消える。
        const nextPoints = changes.points !== undefined ? (changes.points ?? []) : (prev.points ?? [])
        return {
          ...e,
          source: changes.source ?? e.source,
          target: changes.target ?? e.target,
          sourceHandle: changes.source_handle !== undefined ? (changes.source_handle ?? undefined) : e.sourceHandle,
          targetHandle: changes.target_handle !== undefined ? (changes.target_handle ?? undefined) : e.targetHandle,
          data: { edgeStyle: nextStyle, label: nextLabel, points: nextPoints } satisfies EdgeData,
          ...edgeVisuals(nextStyle),
        }
      })
    )
    consumeEdgePatch()
  }, [edgePatch, setEdges, consumeEdgePatch])

  // 右パネルでの接続線削除を消費して線を除去する
  useEffect(() => {
    if (!edgeRemoveId) return
    setEdges((es) => es.filter((e) => e.id !== edgeRemoveId))
    consumeEdgeRemove()
  }, [edgeRemoveId, setEdges, consumeEdgeRemove])

  // waypoint 確定時の保存（tmp- の楽観 edge は保存前なので送らない）
  const commitPoints = useCallback(
    (edgeId: string, points: EdgePoint[]) => {
      if (edgeId.startsWith('tmp-')) return
      updateViewEdge(viewId, edgeId, { points }).catch(() => {})
    },
    [viewId]
  )

  const boardActions = useMemo(
    () => ({ onRemove: handleRemove, onResizeEnd: handleResizeEnd }),
    [handleRemove, handleResizeEnd]
  )
  const edgeActions = useMemo(() => ({ commitPoints }), [commitPoints])

  return (
    <BoardActionsContext.Provider value={boardActions}>
      <EdgeActionsContext.Provider value={edgeActions}>
      <div className="flex flex-col gap-2">
        {/* 上部ツールバー（ボード面を遮らない操作系） */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openAddCards(viewId)} className="flex items-center gap-1">
            <Plus size={15} />
            カードを配置
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBoardCards(viewId)} className="flex items-center gap-1">
            <List size={15} />
            配置カード一覧
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBoardObjects(viewId)} className="flex items-center gap-1">
            <Spline size={15} />
            オブジェクト一覧
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBoardSettings(viewId)} className="flex items-center gap-1">
            <Settings size={15} />
            ボード設定
          </Button>
        </div>

        <div
          ref={boardRef}
          className="relative h-[72vh] w-full overflow-hidden rounded-xl border border-border bg-center bg-cover"
          style={{
            backgroundColor: boardSettings.bg_color || 'var(--ivory-dark)',
            ...(backgroundImageUrl ? { backgroundImage: `url("${backgroundImageUrl}")` } : {}),
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleDragStop}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onConnect={handleConnect}
            onEdgesDelete={handleEdgesDelete}
            onEdgeClick={handleEdgeClick}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'editable' }}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            style={{ backgroundColor: 'transparent' }}
          >
            {(boardSettings.bg_pattern ?? 'dots') !== 'none' && (
              <Background
                variant={boardSettings.bg_pattern === 'grid' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
                gap={22}
                size={2.4}
                color={boardSettings.pattern_color || '#ffffff'}
              />
            )}
            {boardSettings.controls !== false && <Controls showInteractive={false} />}
            {/* 右パネルを開いている間はミニマップをパネル幅ぶん左へ寄せて隠れないようにする */}
            {boardSettings.minimap !== false && (
              <MiniMap pannable zoomable style={panelMode === 'closed' ? undefined : { right: panelWidth + 12 }} />
            )}
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">上の「カードを配置」からカードを置いてみましょう。</p>
            </div>
          )}
        </div>
      </div>
      </EdgeActionsContext.Provider>
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
