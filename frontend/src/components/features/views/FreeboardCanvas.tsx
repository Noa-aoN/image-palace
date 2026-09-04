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
import {
  Plus, List, Spline, Settings, ArrowUpToLine, ArrowDownToLine,
  ArrowUp, ArrowDown, Trash2, Download, Square, ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/button'
import { proxiedDataUrl, nextFrame } from '@/lib/boardExport'
import { safeFileName } from '@/lib/download'
import {
  addViewItem,
  removeViewItem,
  updateViewItemPosition,
  addViewItems,
  addViewEdge,
  updateViewEdge,
  removeViewEdge,
  reorderBoardLayers,
} from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import type { ViewItemPlacement, ViewEdge, ViewEdgeStyle, EdgePoint } from '@/types/view'
import type { Item } from '@/types/item'
import { BoardActionsContext, CardNode, CARD_DEFAULT_W, CARD_DEFAULT_H, type CardNodeType } from './CardNode'
import { EditableEdge, EdgeActionsContext } from './EditableEdge'
import { DraggableMiniMap } from './DraggableMiniMap'
import { persist } from '@/lib/api/persist'
import { ShapeNode, SHAPE_MIN_W, type ShapeNodeType } from '@/components/features/views/ShapeNode'
import { isClick, rectFromDrag, centeredAt, bandStyle } from '@/lib/shape-placement'
import {
  createViewShape,
  removeViewShape,
  reorderViewObjects,
  updateViewShape,
} from '@/lib/api/views'
import type { BoardShape, BoardShapeKind } from '@/types/view'

const nodeTypes = { card: CardNode, shape: ShapeNode }
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

/**
 * 図形をノードにする。
 *
 * **かこみは、いちばん後ろへ置く。** 前に出ると囲ったカードが隠れる。
 * `zIndex` を負にして、カード（0以上）より必ず奥にする。
 */
function toShapeNode(shape: BoardShape): ShapeNodeType {
  return {
    id: shape.id,
    type: 'shape',
    position: { x: shape.x, y: shape.y },
    data: { shape },
    width: shape.width,
    height: shape.height,
    zIndex: shape.kind === 'frame' ? -1000 + shape.z_index : shape.z_index,
    // かこみは掴んでも中のカードを巻き込まない（縁と見出しだけが掴める）
    selectable: true,
  }
}

/** 盤に載るもの。カードか図形 */
type BoardNode = CardNodeType | ShapeNodeType

const isShapeNode = (node: BoardNode): node is ShapeNodeType => node.type === 'shape'
const isCardNode = (node: BoardNode): node is CardNodeType => node.type === 'card'

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
      // 破線・点線・二重線は EditableEdge 側で描く（太さに応じて刻みを変えるため）
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
  /** ボードに置いた図形。かこみは後ろから並ぶ */
  initialShapes?: BoardShape[]
  initialEdges: ViewEdge[]
  aiEditAction?: ReactNode
  aiEditHistoryActions?: ReactNode
}

function Canvas({
  viewId, viewName, initialItems, initialShapes = [], initialEdges,
  aiEditAction, aiEditHistoryActions,
}: FreeboardCanvasProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  /**
   * 盤に載るもの。**カードと図形を同じ並びで持つ。**
   *
   * 別々に持つと、選択・重なり順・掴んで動かす、が全部2通りになる。
   * React Flow は種類の違うノードを1つの並びで扱えるので、それに乗る。
   */
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(
    [ ...initialShapes.map(toShapeNode), ...initialItems.map(toNode) ]
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges.map(viewToEdge))
  const { screenToFlowPosition, setCenter, getZoom, getNodes, getEdges, fitView, getViewport, setViewport } =
    useReactFlow()

  const openCard = useRightPanelStore((s) => s.openCard)
  const openShape = useRightPanelStore((s) => s.openShape)
  const shapePatch = useRightPanelStore((s) => s.shapePatch)
  const consumeShapePatch = useRightPanelStore((s) => s.consumeShapePatch)
  const shapeRemoveId = useRightPanelStore((s) => s.shapeRemoveId)
  const consumeShapeRemove = useRightPanelStore((s) => s.consumeShapeRemove)
  const layerOrder = useRightPanelStore((s) => s.layerOrder)
  const consumeLayerOrder = useRightPanelStore((s) => s.consumeLayerOrder)
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
  const pendingAddItems = useRightPanelStore((s) => s.pendingAddItems)
  const consumeAddMany = useRightPanelStore((s) => s.consumeAddMany)
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
      persist(() => removeViewItem(viewId, itemId), { key: `view:${viewId}:item:${itemId}:remove` })
    },
    [viewId, setNodes, setEdges]
  )

  /*
    ドラッグ完了時に座標を保存。

    **サーバーに入るのは盤面の座標**（React Flow がノードの translate に書く値）で、
    画面上のピクセル位置ではない。両者は
      画面位置 = 盤面の左上 + パン量 + 盤面座標 × ズーム
    の関係にある。実測（zoom 0.9）で
      盤面座標 (659, 364) → 画面 (755.2, 642.8)  差 0.0px
    と一致した。読み直したときに数が違って見えても、位置は保たれている。
  */
  /**
   * 図形を置く。**いま見えている真ん中に置く。**
   *
   * 原点に置くと、盤の端まで移動して探すことになる。
   * 見えている場所に出れば、置いた直後に掴んで動かせる。
   */
  /**
   * 図形を作る。**引いた範囲があればその大きさで、無ければ既定の大きさで。**
   *
   * 既定の大きさで作るときだけ、大きさをサーバーに決めさせてから
   * 押した点が中心に来るように置き直す（種類ごとの既定はサーバーが正本）。
   */
  const createShape = async (kind: BoardShapeKind, at: { x: number; y: number }, size?: { width: number; height: number }) => {
    try {
      const shape = await createViewShape(viewId, {
        kind,
        x: at.x,
        y: at.y,
        ...(size ?? {}),
      })
      if (size) {
        setNodes((current) => [ ...current, toShapeNode(shape) ])
        return
      }
      // 押した点を左上にすると、指の右下へ伸びて出る。中心を合わせる
      const centred = { ...shape, ...centeredAt(at, shape.width, shape.height) }
      await updateViewShape(viewId, shape.id, { x: centred.x, y: centred.y })
      setNodes((current) => [ ...current, toShapeNode(centred) ])
    } catch {
      // 置けなかったときは何も起きない（盤は元のまま）
    }
  }

  /**
   * 図形の置き方。
   *
   * 種類を選ぶと**構える**（placing）。盤の上で引けばその大きさ、
   * ちょんと押せば既定の大きさで出る。Esc でやめられる。
   */
  const [placing, setPlacing] = useState<BoardShapeKind | null>(null)
  const [band, setBand] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)

  useEffect(() => {
    if (!placing) return

    const stop = () => {
      setPlacing(null)
      setBand(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    // **盤の外を押したら、構えを解く。** 解かないまま残ると、
    // ずっとあとで盤を押したときに図形ができて、原因が結び付かない
    const onDown = (event: PointerEvent) => {
      if (!boardRef.current?.contains(event.target as Node)) stop()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [placing])

  /**
   * 図形を置けない場所。**ここを押したら、置くのをやめる。**
   *
   * 構えている間はどこを押しても図形ができていたので、カードを掴もうとして
   * 図形が生まれることがあった。**押した本人には「勝手に増えた」としか見えない。**
   * 空いている場所を押したときだけ置く。
   */
  const NOT_A_PLACE = '.react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__minimap, .react-flow__panel'

  const handlePlacePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!placing || event.button !== 0) return

    // カードや線の上なら、置かずにやめる（掴もうとしただけ、と読む）
    if ((event.target as Element).closest?.(NOT_A_PLACE)) {
      setPlacing(null)
      setBand(null)
      return
    }

    // 構えている間は、盤の掴み（パン）も範囲選択も起きないようにする
    event.preventDefault()
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    const point = { x: event.clientX, y: event.clientY }
    setBand({ start: point, end: point })
  }

  const handlePlacePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!band) return
    setBand({ ...band, end: { x: event.clientX, y: event.clientY } })
  }

  const handlePlacePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!placing || !band) return
    event.preventDefault()
    event.stopPropagation()
    const end = { x: event.clientX, y: event.clientY }
    const kind = placing
    setPlacing(null)
    setBand(null)

    const from = screenToFlowPosition(band.start)
    const to = screenToFlowPosition(end)
    if (isClick(band.start, end)) {
      void createShape(kind, { x: Math.round(from.x), y: Math.round(from.y) })
      return
    }
    const rect = rectFromDrag(from, to, SHAPE_MIN_W)
    void createShape(kind, { x: rect.x, y: rect.y }, { width: rect.width, height: rect.height })
  }

  /** 図形の置き場所と大きさを保存する。カードと同じ key の付け方 */
  const persistShape = (id: string, patch: Parameters<typeof updateViewShape>[2]) => {
    persist(() => updateViewShape(viewId, id, patch), { key: `view:${viewId}:shape:${id}:pos` })
  }

  const removeShape = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id))
      persist(() => removeViewShape(viewId, id), { key: `view:${viewId}:shape:${id}:remove` })
    },
    [viewId, setNodes]
  )

  const handleDragStop: OnNodeDrag<BoardNode> = useCallback(
    (_event, node) => {
      const at = { x: Math.round(node.position.x), y: Math.round(node.position.y) }
      // 図形とカードは置き場所の持ち方が違う。**保存先だけ分ける**
      if (isShapeNode(node)) {
        persist(() => updateViewShape(viewId, node.id, at), { key: `view:${viewId}:shape:${node.id}:pos` })
        return
      }
      // 同じカードを動かし直したら、**新しい位置だけ**を送る
      persist(() => updateViewItemPosition(viewId, node.id, at), { key: `view:${viewId}:item:${node.id}:pos` })
    },
    [viewId]
  )

  // リサイズ確定時にサイズと座標を保存
  const handleResizeEnd = useCallback(
    (itemId: string, size: { x: number; y: number; width: number; height: number }) => {
      persist(
        () =>
          updateViewItemPosition(viewId, itemId, {
            x: Math.round(size.x),
            y: Math.round(size.y),
            width: Math.round(size.width),
            height: Math.round(size.height),
          }),
        { key: `view:${viewId}:item:${itemId}:pos` }
      )
    },
    [viewId]
  )

  /**
   * 図形の大きさを保存する。
   *
   * カードは `CardNode` が `onResizeEnd` を呼んでくれるが、図形は
   * `NodeResizer` を素で使っているので、**ノードの変化から拾う**。
   * `dimensions` の変化は掴んでいる間も届くので、離したときだけ保存する
   */
  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      changes.forEach((change) => {
        if (change.type !== 'dimensions' || change.resizing) return

        const node = getNodes().find((n) => n.id === change.id) as BoardNode | undefined
        if (!node || !isShapeNode(node)) return

        persistShape(node.id, {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
          width: Math.round(node.width ?? 0),
          height: Math.round(node.height ?? 0),
        })
      })
    },
    // persistShape は viewId しか見ない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ onNodesChange, getNodes, viewId ]
  )

  // ダブルクリックで既定サイズに戻す
  const handleNodeDoubleClick: NodeMouseHandler<BoardNode> = useCallback(
    (_event, node) => {
      // 図形は既定の大きさへ戻さない（種類ごとに違い、戻す意味が薄い）
      if (!isCardNode(node)) return

      setNodes((ns) =>
        ns.map((n) => (n.id === node.id ? { ...n, width: CARD_DEFAULT_W, height: CARD_DEFAULT_H } : n))
      )
      persist(
          () => updateViewItemPosition(viewId, node.id, { width: CARD_DEFAULT_W, height: CARD_DEFAULT_H }),
          { key: `view:${viewId}:item:${node.id}:pos` }
        )
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
  const handleNodeClick: NodeMouseHandler<BoardNode> = useCallback(
    (_event, node) => {
      const selNodes = getNodes().filter((n) => n.selected)
      const selEdges = getEdges().filter((e) => e.selected)
      if (selNodes.length + selEdges.length > 1) {
        // 一括編集はカードと線のためのもの。図形は数に入れない
        const cardIds = selNodes.filter((n) => n.type === 'card').map((n) => n.id)
        openBulk(viewId, cardIds, selEdges.map((e) => e.id))
        return
      }
      // 図形は見た目を直すパネル、カードは中身のパネル
      const target = node as BoardNode
      if (isShapeNode(target)) openShape(viewId, target.data.shape)
      else openCard(node.id, viewId)
    },
    [viewId, getNodes, getEdges, openBulk, openCard, openShape]
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
  const [ctxMenu, setCtxMenu] =
    useState<{ x: number; y: number; kind: 'card' | 'edge' | 'shape'; targetIds: string[] } | null>(null)

  const openCtxMenu = useCallback(
    (event: { clientX: number; clientY: number }, kind: 'card' | 'edge' | 'shape', targetIds: string[]) => {
      const rect = boardRef.current?.getBoundingClientRect()
      setCtxMenu({ x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0), kind, targetIds })
    },
    []
  )

  const handleNodeContextMenu: NodeMouseHandler<BoardNode> = useCallback(
    (event, node) => {
      event.preventDefault()
      // 図形とカードは、右クリックでできることが違う（図形は削除だけ）
      const kind = node.type === 'shape' ? 'shape' : 'card'
      const selectedIds = nodes.filter((n) => n.selected && n.type === node.type).map((n) => n.id)
      openCtxMenu(event, kind, selectedIds.length > 1 && selectedIds.includes(node.id) ? selectedIds : [ node.id ])
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
      if (ctxMenu.kind === 'shape' || ctxMenu.kind === 'edge') {
        // **図形と線は同じ土俵で前後を決める。** 分けていた頃は、
        // 線の上に付箋を置くことができなかった（右パネルの一覧と同じ扱い）。
        // かこみだけは奥のまま（前に出ると囲った中身が隠れる）
        const pool = [
          ...nodes
            .filter(isShapeNode)
            .filter((n) => n.data.shape.kind !== 'frame')
            .map((n) => ({ id: n.id, kind: 'shape' as const, z: n.zIndex ?? 0 })),
          ...edges.map((e) => ({ id: e.id, kind: 'edge' as const, z: typeof e.zIndex === 'number' ? e.zIndex : 0 })),
        ]
        const ordered = computeLayerOrder(pool, (x) => x.z, op, targets)
        const map = new Map(ordered.map((x, i) => [ x.id, i + 1 ]))
        setNodes((ns) => ns.map((n) => (map.has(n.id) && isShapeNode(n) ? { ...n, zIndex: map.get(n.id) } : n)))
        setEdges((es) => es.map((e) => (map.has(e.id) ? { ...e, zIndex: map.get(e.id) } : e)))
        persist(
          () => reorderViewObjects(viewId, [ ...ordered ].reverse().map((x) => ({ kind: x.kind, id: x.id }))),
          { key: `view:${viewId}:objectOrder` }
        )
      } else if (ctxMenu.kind === 'card') {
        const cards = nodes.filter(isCardNode)
        const ordered = computeLayerOrder(cards, (n) => n.zIndex ?? 0, op, targets)
        const map = new Map(ordered.map((n, i) => [n.id, i + 1]))
        setNodes((ns) => ns.map((n) => (map.has(n.id) ? { ...n, zIndex: map.get(n.id) } : n)))
        persist(() => reorderBoardLayers(viewId, [...ordered].reverse().map((n) => n.id)), {
          key: `view:${viewId}:layers`,
        })
      }
      setCtxMenu(null)
    },
    [ctxMenu, nodes, edges, viewId, setNodes, setEdges]
  )

  // ボードから削除（カード＝端点の接続線も掃除／接続線＝その線のみ）。
  const applyDelete = useCallback(() => {
    if (!ctxMenu) return
    if (ctxMenu.kind === 'shape') {
      ctxMenu.targetIds.forEach((id) => removeShape(id))
    } else if (ctxMenu.kind === 'card') {
      ctxMenu.targetIds.forEach((id) => handleRemove(id))
    } else {
      const ids = new Set(ctxMenu.targetIds)
      setEdges((es) => es.filter((e) => !ids.has(e.id)))
      ctxMenu.targetIds.forEach((id) => {
        if (!id.startsWith('tmp-')) persist(() => removeViewEdge(viewId, id), { key: `view:${viewId}:edge:${id}:remove` })
      })
    }
    setCtxMenu(null)
  }, [ctxMenu, handleRemove, removeShape, setEdges, viewId])

  /**
   * パネルで直した図形を、盤へ映す。
   * **サーバの返事を待たない**（待つと、打った文字が遅れて出る）
   */
  useEffect(() => {
    if (!shapePatch) return

    setNodes((current) =>
      current.map((node) =>
        node.id === shapePatch.id && isShapeNode(node)
          ? { ...node, data: { shape: shapePatch } }
          : node
      )
    )
    consumeShapePatch()
  }, [shapePatch, consumeShapePatch, setNodes])

  useEffect(() => {
    if (!shapeRemoveId) return

    setNodes((current) => current.filter((node) => node.id !== shapeRemoveId))
    consumeShapeRemove()
  }, [shapeRemoveId, consumeShapeRemove, setNodes])

  /**
   * 右パネルの一覧で並べ替えられた重なり順を、盤へ当てる。
   *
   * **保存するだけにしていた頃は、並べ替えても見た目が変わらなかった。**
   * 再読込すれば直っていたが、操作した本人には効いていないようにしか見えない。
   *
   * 一覧は手前から並んでいるので、**末尾ほど小さい番号**を配る。
   * かこみは一覧の外にいるので触らない（必ずいちばん後ろに敷く）
   */
  useEffect(() => {
    if (!layerOrder) return

    const z = new Map(layerOrder.map((entry, index) => [ entry.id, layerOrder.length - index ]))
    setNodes((current) =>
      current.map((node) =>
        z.has(node.id) && isShapeNode(node) && node.data.shape.kind !== 'frame'
          ? { ...node, zIndex: z.get(node.id) }
          : node
      )
    )
    setEdges((current) => current.map((edge) => (z.has(edge.id) ? { ...edge, zIndex: z.get(edge.id) } : edge)))
    consumeLayerOrder()
  }, [layerOrder, consumeLayerOrder, setNodes, setEdges])

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
      persist(
        () =>
          updateViewEdge(viewId, oldEdge.id, {
            source_node_id: newConnection.source ?? undefined,
            target_node_id: newConnection.target ?? undefined,
            source_handle: newConnection.sourceHandle ?? null,
            target_handle: newConnection.targetHandle ?? null,
          }),
        { key: `view:${viewId}:edge:${oldEdge.id}:ends` }
      )
    },
    [viewId, setEdges]
  )

  // 選択＋Delete で接続線を削除
  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((e) => {
        if (!e.id.startsWith('tmp-')) persist(() => removeViewEdge(viewId, e.id), { key: `view:${viewId}:edge:${e.id}:remove` })
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

  /**
   * デッキごと、まとめて置く。
   *
   * **1枚ずつ置く道を繰り返してはいけない。** あちらは置くたびに盤を中央へ
   * 寄せ直すので、30枚置けば30回画面が跳ねる。しかも置き場所がほぼ重なる。
   *
   * 見えている場所の下に、格子で並べる。重なりは「AIで整える」で解ける
   */
  useEffect(() => {
    if (!pendingAddItems?.length) return

    const fresh = pendingAddItems.filter((item) => !placedIds.has(item.id))
    consumeAddMany()
    if (fresh.length === 0) return

    const rect = boardRef.current?.getBoundingClientRect()
    const corner = rect
      ? screenToFlowPosition({ x: rect.left + 80, y: rect.top + 80 })
      : { x: 0, y: 0 }
    const columns = Math.max(1, Math.ceil(Math.sqrt(fresh.length)))

    const placements: ViewItemPlacement[] = fresh.map((item, index) => ({
      item_id: item.id,
      x: Math.round(corner.x + (index % columns) * (CARD_W + 40)),
      y: Math.round(corner.y + Math.floor(index / columns) * (CARD_H + 40)),
      z_index: 0,
      item: { id: item.id, title: item.title, generation_status: item.generation_status, media: item.media },
    }))

    setNodes((ns) => [...ns, ...placements.map(toNode)])
    // **1往復で入れる。** 1枚ずつだと30枚で30往復になる
    addViewItems(viewId, fresh.map((item) => item.id))
      .then(() => {
        // 置き場所はこちらで決めたので、入れたあとに書き戻す
        placements.forEach((placement) => {
          persist(() => updateViewItemPosition(viewId, placement.item_id, { x: placement.x, y: placement.y }), {
            key: `view:${viewId}:item:${placement.item_id}:pos`,
          })
        })
      })
      .catch(() => {
        const ids = new Set(fresh.map((item) => item.id))
        setNodes((ns) => ns.filter((n) => !ids.has(n.id)))
      })
  }, [pendingAddItems, consumeAddMany, placedIds, viewId, screenToFlowPosition, setNodes])

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
      persist(() => updateViewEdge(viewId, e.id, { style: { ...(prev.edgeStyle ?? {}), ...partial } }), {
        key: `view:${viewId}:edge:${e.id}:style`,
      })
    })
    consumeBulkStylePatch()
  }, [bulkStylePatch, edges, viewId, setEdges, consumeBulkStylePatch])

  // 一括: 選択したカードを同じサイズにそろえる＋永続化する
  useEffect(() => {
    if (!bulkResize) return
    const { itemIds, width, height } = bulkResize
    const idSet = new Set(itemIds)
    setNodes((ns) => ns.map((n) => (idSet.has(n.id) ? { ...n, width, height } : n)))
    itemIds.forEach((id) =>
      persist(() => updateViewItemPosition(viewId, id, { width, height }), {
        key: `view:${viewId}:item:${id}:pos`,
      })
    )
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
    itemIds.forEach((id) => persist(() => removeViewItem(viewId, id), { key: `view:${viewId}:item:${id}:remove` }))
    edgeIds.forEach((id) => {
      if (!id.startsWith('tmp-')) persist(() => removeViewEdge(viewId, id), { key: `view:${viewId}:edge:${id}:remove` })
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
      persist(() => updateViewEdge(viewId, edgeId, { points }), { key: `view:${viewId}:edge:${edgeId}:points` })
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
  // 二重線は真ん中を盤の色で抜いて描くので、盤の色を線側にも渡す
  const edgeActions = useMemo(
    () => ({ commitPoints, boardBg: boardSettings.bg_color || 'var(--board-bg)' }),
    [commitPoints, boardSettings.bg_color]
  )

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
          {/* 図形を置く。**1つのドロップダウンに畳む。**
              5つを並べると、よく使う「カードを配置」と「AIで整える」が押しのけられる */}
          <ShapeMenu onAdd={setPlacing} />
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
          onPointerDown={handlePlacePointerDown}
          onPointerMove={handlePlacePointerMove}
          onPointerUp={handlePlacePointerUp}
          className={`relative h-[72vh] w-full overflow-hidden rounded-xl border bg-center bg-cover ${
            placing ? 'cursor-crosshair border-primary' : 'border-border'
          }`}
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
            onNodesChange={handleNodesChange}
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
            panOnDrag={!placing}
            nodesDraggable={!placing}
            elementsSelectable={!placing}
            /* 構えている間は盤を掴めないようにする。掴めると、引いた範囲ではなく盤が動く */
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

          {/* 引いている最中の帯。**離す前に、何がどこへ出るかを見せる** */}
          {band && boardRef.current && (
            <div
              className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary bg-primary/10"
              style={(() => {
                const box = boardRef.current.getBoundingClientRect()
                const style = bandStyle(band.start, band.end)
                return { left: style.left - box.left, top: style.top - box.top, width: style.width, height: style.height }
              })()}
            />
          )}

          {/* 構えていることを言葉でも出す。カーソルの形だけでは、
              なぜ盤が掴めないのか分からない */}
          {placing && (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
              <span className="rounded-full bg-foreground/85 px-3 py-1 text-xs text-background">
                {SHAPE_LABELS[placing]}を置きます — ドラッグで大きさを決める／クリックで既定の大きさ／Esc でやめる
              </span>
            </div>
          )}

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
                    {ctxMenu.kind === 'card' ? 'カード' : ctxMenu.kind === 'shape' ? '図形' : '接続線'}
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

/**
 * 図形を置くボタン。
 *
 * 図を描く道具（Figma / Miro / FigJam）が共通して持っているものだけにした。
 * 種類を増やすと選ぶ手間が増えるわりに、できる図はほとんど変わらない。
 */
/** 構えているときの案内に使う。SHAPE_CHOICES から引くと、並び順に依存してしまう */
const SHAPE_LABELS: Record<BoardShapeKind, string> = {
  rectangle: '四角',
  ellipse: '丸',
  sticky: '付箋',
  text: '文字',
  frame: 'かこみ',
}

const SHAPE_CHOICES: { kind: BoardShapeKind; label: string; hint: string }[] = [
  { kind: 'frame', label: 'かこみ', hint: 'カードの後ろに敷いて、群れを囲みます' },
  { kind: 'sticky', label: '付箋', hint: '思いつきを貼ります' },
  { kind: 'text', label: '文字', hint: '見出しや注釈を置きます' },
  { kind: 'rectangle', label: '四角', hint: '区切る・囲む' },
  { kind: 'ellipse', label: '丸', hint: '強調する' },
]

function ShapeMenu({ onAdd }: { onAdd: (kind: BoardShapeKind) => void }) {
  return (
    <DropdownMenu>
      {/* Base UI の Trigger は自前で要素を描くので、隣のボタンと同じ見た目を直接あてる */}
      <DropdownMenuTrigger className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted">
        <Square size={15} />
        図形
        <ChevronDown size={13} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {/* 見出しは群の中でしか使えない。包まないと Base UI が落ちる */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>置くもの</DropdownMenuLabel>
          {/* 選んだ時点では出さない。**盤の上で引いた範囲がそのまま図形になる** */}
          {SHAPE_CHOICES.map((choice) => (
            <DropdownMenuItem
              key={choice.kind}
              onClick={() => onAdd(choice.kind)}
              className="flex-col items-start gap-0.5"
            >
              <span>{choice.label}</span>
              <span className="text-2xs text-muted-foreground">{choice.hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
