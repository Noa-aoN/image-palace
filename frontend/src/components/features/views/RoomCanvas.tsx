'use client'

import { memo, useCallback } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint } from '@/types/space'

type PointNodeData = { point: SpacePoint; index: number }
type PointNodeType = Node<PointNodeData, 'point'>

// room の loci ポイントノード（loci 画像 + 名前 + 序数、配置済みカードの目印）
function PointNodeComponent({ data }: NodeProps<PointNodeType>) {
  const { point, index } = data
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null
  return (
    <div className="w-28 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        <span
          className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: 'var(--palace)' }}
        >
          {index + 1}
        </span>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={point.name ?? ''} className="h-full w-full object-cover" draggable={false} loading="lazy" />
        ) : (
          <span className="px-1 text-center text-[9px] text-muted-foreground">{point.name || '未命名'}</span>
        )}
        {point.item && (
          <span
            className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
            title="カード配置済み"
          />
        )}
      </div>
      <div className="truncate px-1.5 py-1 text-[11px] font-medium">{point.name || '未命名'}</div>
    </div>
  )
}
const PointNode = memo(PointNodeComponent)
const nodeTypes = { point: PointNode }

function toNode(point: SpacePoint, index: number): PointNodeType {
  return {
    id: point.id,
    type: 'point',
    position: { x: point.x, y: point.y },
    data: { point, index },
  }
}

type RoomCanvasProps = {
  spaceId: string
  points: SpacePoint[]
  onMoved: (pointId: string, x: number, y: number) => void
}

function Canvas({ spaceId, points, onMoved }: RoomCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState<PointNodeType>(points.map(toNode))

  // ドラッグ完了時に座標を保存し、親 state にも反映する
  const handleDragStop: OnNodeDrag<PointNodeType> = useCallback(
    (_event, node) => {
      const x = Math.round(node.position.x)
      const y = Math.round(node.position.y)
      onMoved(node.id, x, y)
      updateSpacePoint(spaceId, node.id, { x, y }).catch(() => {})
    },
    [spaceId, onMoved]
  )

  return (
    <div
      className="relative h-[60vh] w-full overflow-hidden rounded-xl border border-border"
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

      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">下の「ポイントを追加」で点を作り、ドラッグで間取りに配置しましょう。</p>
        </div>
      )}
    </div>
  )
}

export function RoomCanvas(props: RoomCanvasProps) {
  // ポイントの構成（追加/削除・画像の有無・カードの有無・名前）が変わったら
  // 内部ノードを seed し直すため key で remount する。x/y と生成中ステータスは
  // 含めない（ドラッグ確定や生成ポーリングのたびに remount しないように）。
  const signature = props.points
    .map((p) => `${p.id}:${p.image ? 1 : 0}:${p.item ? 1 : 0}:${p.name ?? ''}`)
    .join('|')

  return (
    <ReactFlowProvider>
      <Canvas key={signature} {...props} />
    </ReactFlowProvider>
  )
}
