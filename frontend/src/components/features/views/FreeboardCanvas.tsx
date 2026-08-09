'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  MarkerType,
  type OnNodeDrag,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnConnect,
  type OnSelectionChangeFunc,
  type Connection,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, List, Spline, Settings, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown, Trash2, Download } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/button'
import { proxiedDataUrl, nextFrame } from '@/lib/boardExport'
import { safeFileName } from '@/lib/download'
import {
  addViewItem,
  removeViewItem,
  updateViewItemPosition,
  addViewEdge,
  updateViewEdge,
  removeViewEdge,
  reorderBoardLayers,
  reorderViewEdges,
} from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import type { ViewItemPlacement, ViewEdge, ViewEdgeStyle, EdgePoint } from '@/types/view'
import type { Item } from '@/types/item'
import { BoardActionsContext, CardNode, CARD_DEFAULT_W, CARD_DEFAULT_H, type CardNodeType } from './CardNode'
import { EditableEdge, EdgeActionsContext } from './EditableEdge'
import { DraggableMiniMap } from './DraggableMiniMap'

const nodeTypes = { card: CardNode }
const edgeTypes = { editable: EditableEdge }
// カードノードの既定サイズ（中央寄せ計算・未指定サイズのフォールバック）
const CARD_W = CARD_DEFAULT_W
const CARD_H = CARD_DEFAULT_H
// 全体表示でカードへ寄りすぎないよう、少し引いた倍率を上限にする。
// サーバ側の外周余白と合わせて、AI 配置後にも盤面の文脈が見える状態を保つ。
const BOARD_FIT_VIEW_OPTIONS = { padding: 0.3, maxZoom: 0.9 } as const

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
    zIndex: e.z_index ?? 0,
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

type LayerOp = 'front' | 'back' | 'forward' | 'backward'

// 現在の重なり順（zIndex 昇順、同値は配列順で安定）を back→front で求め、
// レイヤー操作を適用した新しい back→front 配列を返す。カード・接続線で共用する。
function computeLayerOrder<T extends { id: string }>(
  items: T[],
  zOf: (t: T) => number,
  op: LayerOp,
  targetIds: Set<string>
): T[] {
  const ordered = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => zOf(a.it) - zOf(b.it) || a.i - b.i)
    .map((x) => x.it)
  if (op === 'front' || op === 'back') {
    const targets = ordered.filter((x) => targetIds.has(x.id))
    const rest = ordered.filter((x) => !targetIds.has(x.id))
    return op === 'front' ? [...rest, ...targets] : [...targets, ...rest]
  }
  // 1段ずつ（単一対象）：隣と入れ替える
  const pos = ordered.findIndex((x) => targetIds.has(x.id))
  const swap = op === 'forward' ? pos + 1 : pos - 1
  if (pos < 0 || swap < 0 || swap >= ordered.length) return ordered
  const copy = [...ordered]
  ;[copy[pos], copy[swap]] = [copy[swap], copy[pos]]
  return copy
}

type FreeboardCanvasProps = {
  viewId: string
  viewName?: string
  initialItems: ViewItemPlacement[]
  initialEdges: ViewEdge[]
  aiEditAction?: ReactNode
  aiEditHistoryActions?: ReactNode
}

function Canvas({ viewId, viewName, initialItems, initialEdges, aiEditAction, aiEditHistoryActions }: FreeboardCanvasProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNodeType>(initialItems.map(toNode))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges.map(viewToEdge))
  const { screenToFlowPosition, setCenter, getZoom, getNodes, getEdges, fitView, getViewport, setViewport } =
    useReactFlow()

  const openCard = useRightPanelStore((s) => s.openCard)
  const closePanel = useRightPanelStore((s) => s.close)
  const openBoardCards = useRightPanelStore((s) => s.openBoardCards)
  const openAddCards = useRightPanelStore((s) => s.openAddCards)
  const openBoardObjects = useRightPanelStore((s) => s.openBoardObjects)
  const openBoardSettings = useRightPanelStore((s) => s.openBoardSettings)
  const boardSettings = useBoardSettingsStore((s) => s.settings)
  const backgroundImageUrl = useBoardSettingsStore((s) => s.backgroundImageUrl)
  const openEdge = useRightPanelStore((s) => s.openEdge)
  const openBulk = useRightPanelStore((s) => s.openBulk)
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
  const bulkStylePatch = useRightPanelStore((s) => s.bulkStylePatch)
  const consumeBulkStylePatch = useRightPanelStore((s) => s.consumeBulkStylePatch)
  const bulkResize = useRightPanelStore((s) => s.bulkResize)
  const consumeBulkResize = useRightPanelStore((s) => s.consumeBulkResize)
  const bulkRemove = useRightPanelStore((s) => s.bulkRemove)
  const consumeBulkRemove = useRightPanelStore((s) => s.consumeBulkRemove)
  const layerPatch = useRightPanelStore((s) => s.layerPatch)
  const consumeLayerPatch = useRightPanelStore((s) => s.consumeLayerPatch)

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

  // 複数選択（Shift＋範囲ドラッグ等、クリックを伴わない選択）だけをここで一括パネルにする。
  // 単一の選択は onNodeClick/onEdgeClick 側で開く（掴んで動かすだけの pointerdown 選択では
  // 開かず、実クリック時のみ開くようにするため）。count===0 は onPaneClick で閉じ判定する。
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selNodes, edges: selEdges }) => {
      if (selNodes.length + selEdges.length > 1) {
        openBulk(viewId, selNodes.map((n) => n.id), selEdges.map((e) => e.id))
      }
    },
    [viewId, openBulk]
  )

  // カード/接続線の「実クリック」でパネルを開く（ドラッグ移動では発火しない）。
  // 複数選択された状態でのクリックは一括、単一はそれぞれのパネルにする。
  // 現在の選択集合はライブ参照（getNodes/getEdges）で判定し、状態の取りこぼしを避ける。
  const handleNodeClick: NodeMouseHandler<CardNodeType> = useCallback(
    (_event, node) => {
      const selNodes = getNodes().filter((n) => n.selected)
      const selEdges = getEdges().filter((e) => e.selected)
      if (selNodes.length + selEdges.length > 1) {
        openBulk(viewId, selNodes.map((n) => n.id), selEdges.map((e) => e.id))
      } else {
        openCard(node.id, viewId)
      }
    },
    [viewId, getNodes, getEdges, openBulk, openCard]
  )

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      const selNodes = getNodes().filter((n) => n.selected)
      const selEdges = getEdges().filter((e) => e.selected)
      if (selNodes.length + selEdges.length > 1) {
        openBulk(viewId, selNodes.map((n) => n.id), selEdges.map((e) => e.id))
      } else {
        openEdge(viewId, edgeToView(edge))
      }
    },
    [viewId, getNodes, getEdges, openBulk, openEdge]
  )

  // 空白（カード/オブジェクト以外）クリックで、選択駆動のパネル（カード/接続線/一括）だけ閉じる。
  // ツールバーで開いた一覧・追加・ボード設定パネルは維持する。
  const handlePaneClick = useCallback(() => {
    const mode = useRightPanelStore.getState().mode
    if (mode === 'card' || mode === 'edge' || mode === 'bulk') {
      closePanel()
    }
  }, [closePanel])

  // 右クリックのコンテキストメニュー（レイヤー操作＋ボードから削除）。位置はボード左上からの相対座標。
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; kind: 'card' | 'edge'; targetIds: string[] } | null>(null)

  const openCtxMenu = useCallback(
    (event: { clientX: number; clientY: number }, kind: 'card' | 'edge', targetIds: string[]) => {
      const rect = boardRef.current?.getBoundingClientRect()
      setCtxMenu({ x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0), kind, targetIds })
    },
    []
  )

  const handleNodeContextMenu: NodeMouseHandler<CardNodeType> = useCallback(
    (event, node) => {
      event.preventDefault()
      // 選択中のカードを右クリックしたら選択集合すべてに適用（複数選択バルク）
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id)
      openCtxMenu(event, 'card', selectedIds.length > 1 && selectedIds.includes(node.id) ? selectedIds : [node.id])
    },
    [nodes, openCtxMenu]
  )

  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault()
      const selectedIds = edges.filter((e) => e.selected).map((e) => e.id)
      openCtxMenu(event, 'edge', selectedIds.length > 1 && selectedIds.includes(edge.id) ? selectedIds : [edge.id])
    },
    [edges, openCtxMenu]
  )

  // レイヤー操作：対象種別に応じて全体の z を order 通りに振り直し（reorder エンドポイントで一括永続化）。
  const applyLayer = useCallback(
    (op: LayerOp) => {
      if (!ctxMenu) return
      const targets = new Set(ctxMenu.targetIds)
      if (ctxMenu.kind === 'card') {
        const ordered = computeLayerOrder(nodes, (n) => n.zIndex ?? 0, op, targets)
        const map = new Map(ordered.map((n, i) => [n.id, i + 1]))
        setNodes((ns) => ns.map((n) => ({ ...n, zIndex: map.get(n.id) ?? n.zIndex })))
        reorderBoardLayers(viewId, [...ordered].reverse().map((n) => n.id)).catch(() => {})
      } else {
        const ordered = computeLayerOrder(edges, (e) => (typeof e.zIndex === 'number' ? e.zIndex : 0), op, targets)
        const map = new Map(ordered.map((e, i) => [e.id, i + 1]))
        setEdges((es) => es.map((e) => ({ ...e, zIndex: map.get(e.id) ?? e.zIndex })))
        reorderViewEdges(viewId, [...ordered].reverse().map((e) => e.id)).catch(() => {})
      }
      setCtxMenu(null)
    },
    [ctxMenu, nodes, edges, viewId, setNodes, setEdges]
  )

  // ボードから削除（カード＝端点の接続線も掃除／接続線＝その線のみ）。
  const applyDelete = useCallback(() => {
    if (!ctxMenu) return
    if (ctxMenu.kind === 'card') {
      ctxMenu.targetIds.forEach((id) => handleRemove(id))
    } else {
      const ids = new Set(ctxMenu.targetIds)
      setEdges((es) => es.filter((e) => !ids.has(e.id)))
      ctxMenu.targetIds.forEach((id) => {
        if (!id.startsWith('tmp-')) removeViewEdge(viewId, id).catch(() => {})
      })
    }
    setCtxMenu(null)
  }, [ctxMenu, handleRemove, setEdges, viewId])

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

  // 既存の接続線の端点（始端/終端）を別ノードへドラッグで付け替える
  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els))
      if (oldEdge.id.startsWith('tmp-')) return // 未保存の楽観 edge は保存後に確定
      updateViewEdge(viewId, oldEdge.id, {
        source_node_id: newConnection.source ?? undefined,
        target_node_id: newConnection.target ?? undefined,
        source_handle: newConnection.sourceHandle ?? null,
        target_handle: newConnection.targetHandle ?? null,
      }).catch(() => {})
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

  // 一括: 選択した接続線すべてに style を部分マージして反映＋永続化する
  useEffect(() => {
    if (!bulkStylePatch) return
    const { edgeIds, partial } = bulkStylePatch
    const idSet = new Set(edgeIds)
    setEdges((es) =>
      es.map((e) => {
        if (!idSet.has(e.id)) return e
        const prev = (e.data ?? {}) as Partial<EdgeData>
        const merged = { ...(prev.edgeStyle ?? {}), ...partial }
        return {
          ...e,
          data: { edgeStyle: merged, label: prev.label ?? null, points: prev.points ?? [] } satisfies EdgeData,
          ...edgeVisuals(merged),
        }
      })
    )
    // 各 edge の現在 style にマージした結果を保存（tmp- は保存前なので送らない）
    edges.forEach((e) => {
      if (!idSet.has(e.id) || e.id.startsWith('tmp-')) return
      const prev = (e.data ?? {}) as Partial<EdgeData>
      updateViewEdge(viewId, e.id, { style: { ...(prev.edgeStyle ?? {}), ...partial } }).catch(() => {})
    })
    consumeBulkStylePatch()
  }, [bulkStylePatch, edges, viewId, setEdges, consumeBulkStylePatch])

  // 一括: 選択したカードを同じサイズにそろえる＋永続化する
  useEffect(() => {
    if (!bulkResize) return
    const { itemIds, width, height } = bulkResize
    const idSet = new Set(itemIds)
    setNodes((ns) => ns.map((n) => (idSet.has(n.id) ? { ...n, width, height } : n)))
    itemIds.forEach((id) => updateViewItemPosition(viewId, id, { width, height }).catch(() => {}))
    consumeBulkResize()
  }, [bulkResize, viewId, setNodes, consumeBulkResize])

  // 一括: 選択したカード・接続線をまとめて削除する（端点が消える接続線も除去）
  useEffect(() => {
    if (!bulkRemove) return
    const { itemIds, edgeIds } = bulkRemove
    const nodeSet = new Set(itemIds)
    const edgeSet = new Set(edgeIds)
    setNodes((ns) => ns.filter((n) => !nodeSet.has(n.id)))
    setEdges((es) => es.filter((e) => !edgeSet.has(e.id) && !nodeSet.has(e.source) && !nodeSet.has(e.target)))
    itemIds.forEach((id) => removeViewItem(viewId, id).catch(() => {}))
    edgeIds.forEach((id) => {
      if (!id.startsWith('tmp-')) removeViewEdge(viewId, id).catch(() => {})
    })
    consumeBulkRemove()
  }, [bulkRemove, viewId, setNodes, setEdges, consumeBulkRemove])

  // 一覧のドラッグ並べ替えを消費して重なり順を反映する（永続化は一覧側で実施済み）
  useEffect(() => {
    if (!layerPatch) return
    const map = new Map(layerPatch.map((u) => [u.id, u.z]))
    setNodes((ns) => ns.map((n) => (map.has(n.id) ? { ...n, zIndex: map.get(n.id) } : n)))
    consumeLayerPatch()
  }, [layerPatch, setNodes, consumeLayerPatch])

  // waypoint 確定時の保存（tmp- の楽観 edge は保存前なので送らない）
  const commitPoints = useCallback(
    (edgeId: string, points: EdgePoint[]) => {
      if (edgeId.startsWith('tmp-')) return
      updateViewEdge(viewId, edgeId, { points }).catch(() => {})
    },
    [viewId]
  )

  // ボード面（背景・パターン・配置カード・接続線）を1枚の PNG に書き出してダウンロードする。
  // 手順: 全カードが収まるよう fitView → カード/背景画像を同一オリジンプロキシ経由で
  // dataURL 化して差し替え（CORS 回避）→ ボード面を撮影（操作系 UI は filter で除外）→ 復元。
  const [exporting, setExporting] = useState(false)
  const handleDownloadImage = useCallback(async () => {
    const board = boardRef.current
    if (!board || getNodes().length === 0 || exporting) return

    // 撮影から除外する操作系 UI（コントロール/ミニマップ/パネル/帰属表示）
    const EXCLUDE = ['react-flow__controls', 'react-flow__minimap', 'react-flow__attribution', 'react-flow__panel', 'board-noexport']

    const prevViewport = getViewport()
    const prevBoardBg = board.style.backgroundImage
    const restoreSrc = new Map<HTMLImageElement, string | null>()

    setExporting(true)
    try {
      // 1) 全カードが収まるようフィット（背景パターンもこのビューでレンダリングされる）
      fitView({ padding: 0.15, duration: 0 })
      await nextFrame()
      await nextFrame()

      // 2) クロスオリジンのカード画像をプロキシ経由の dataURL に差し替える
      const imgEls = Array.from(board.querySelectorAll('img'))
      await Promise.all(
        imgEls.map(async (img) => {
          const src = img.currentSrc || img.src
          if (!src || src.startsWith('data:')) return
          restoreSrc.set(img, img.getAttribute('src'))
          try {
            img.src = await proxiedDataUrl(src)
            await img.decode().catch(() => {})
          } catch {
            /* 取得失敗時は元画像のまま（枠のみ写る） */
          }
        })
      )
      // 背景画像も同様に差し替える
      if (backgroundImageUrl) {
        try {
          const bg = await proxiedDataUrl(backgroundImageUrl)
          board.style.backgroundImage = `url("${bg}")`
        } catch {
          /* 背景画像の取得失敗は無視（背景色で塗られる） */
        }
      }

      // 3) ボード面を撮影
      const dataUrl = await toPng(board, {
        pixelRatio: 2,
        skipFonts: true,
        backgroundColor: getComputedStyle(board).backgroundColor || '#ffffff',
        filter: (node) => !(node instanceof Element) || !EXCLUDE.some((c) => node.classList.contains(c)),
      })
      const a = document.createElement('a')
      a.download = `${safeFileName(viewName || 'board')}.png`
      a.href = dataUrl
      a.click()
    } catch (err) {
      console.error('ボード画像の書き出しに失敗しました', err)
    } finally {
      // 復元（画像 src・背景画像・ビューポート）
      restoreSrc.forEach((src, img) => {
        if (src == null) img.removeAttribute('src')
        else img.setAttribute('src', src)
      })
      board.style.backgroundImage = prevBoardBg
      setViewport(prevViewport, { duration: 0 })
      setExporting(false)
    }
  }, [getNodes, exporting, getViewport, fitView, setViewport, backgroundImageUrl, viewName])

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
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openAddCards(viewId)} className="flex items-center gap-1">
            <Plus size={15} />
            カードを配置
          </Button>
          {aiEditAction}
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
          <Button
            size="sm"
            onClick={handleDownloadImage}
            disabled={nodes.length === 0 || exporting}
            className="flex items-center gap-1 border-transparent bg-[var(--palace)] text-white hover:bg-[var(--palace)]/85"
            title="ボード全体を画像（PNG）で保存"
          >
            <Download size={15} />
            {exporting ? '書き出し中…' : '画像を保存'}
          </Button>
          {aiEditHistoryActions}
          <span className="ml-auto text-xs text-muted-foreground">Shift＋クリックで追加選択 / Shift＋ドラッグで範囲選択</span>
        </div>

        <div
          ref={boardRef}
          className="relative h-[72vh] w-full overflow-hidden rounded-xl border border-border bg-center bg-cover"
          style={{
            backgroundColor: boardSettings.bg_color || 'var(--board-bg)',
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
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={(e) => {
              e.preventDefault()
              setCtxMenu(null)
            }}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            onEdgesDelete={handleEdgesDelete}
            onSelectionChange={handleSelectionChange}
            multiSelectionKeyCode="Shift"
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'editable' }}
            fitView
            fitViewOptions={BOARD_FIT_VIEW_OPTIONS}
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
            {/* ミニマップはドラッグ移動・リサイズ可能。位置は固定（右パネル連動なし） */}
            {/* 既定は非表示。盤を広く使いたい場面が多く、必要な人だけ出せばよい */}
            {boardSettings.minimap === true && <DraggableMiniMap boardRef={boardRef} />}
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">上の「カードを配置」からカードを置いてみましょう。</p>
            </div>
          )}

          {/* 右クリックのコンテキストメニュー（外側クリックで閉じる） */}
          {ctxMenu && (
            <>
              <div className="absolute inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => e.preventDefault()} />
              <div
                className="absolute z-50 min-w-[168px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-md"
                style={{ left: ctxMenu.x, top: ctxMenu.y }}
              >
                {ctxMenu.targetIds.length > 1 && (
                  <p className="px-3 pb-1 pt-0.5 text-xs text-muted-foreground">
                    {ctxMenu.kind === 'card' ? 'カード' : '接続線'}
                    {ctxMenu.targetIds.length}件
                  </p>
                )}
                <button type="button" onClick={() => applyLayer('front')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted">
                  <ArrowUpToLine size={14} />
                  最前面へ
                </button>
                {ctxMenu.targetIds.length === 1 && (
                  <>
                    <button type="button" onClick={() => applyLayer('forward')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted">
                      <ArrowUp size={14} />
                      前面へ
                    </button>
                    <button type="button" onClick={() => applyLayer('backward')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted">
                      <ArrowDown size={14} />
                      背面へ
                    </button>
                  </>
                )}
                <button type="button" onClick={() => applyLayer('back')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted">
                  <ArrowDownToLine size={14} />
                  最背面へ
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={applyDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-muted"
                >
                  <Trash2 size={14} />
                  ボードから削除{ctxMenu.targetIds.length > 1 ? `（${ctxMenu.targetIds.length}件）` : ''}
                </button>
              </div>
            </>
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
