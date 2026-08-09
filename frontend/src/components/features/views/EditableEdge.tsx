'use client'

import {
  createContext,
  memo,
  useContext,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  Position,
  type EdgeProps,
} from '@xyflow/react'
import type { ViewEdgeStyle, EdgePoint } from '@/types/view'

// 折れ点の確定保存はボード側（FreeboardCanvas）へ委譲する（data に関数を入れず lint 回避）。
export const EdgeActionsContext = createContext<{ commitPoints: (edgeId: string, points: EdgePoint[]) => void }>({
  commitPoints: () => {},
})

type EditableEdgeData = { edgeStyle?: ViewEdgeStyle; label?: string | null; points?: EdgePoint[] }

function EditableEdgeComponent(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerStart, markerEnd, style } = props
  const d = (props.data ?? {}) as EditableEdgeData
  const s = d.edgeStyle ?? {}
  const label = d.label
  const points = d.points ?? []

  const { screenToFlowPosition, setEdges } = useReactFlow()
  const { commitPoints } = useContext(EdgeActionsContext)
  const latest = useRef<EdgePoint[]>(points)
  const moved = useRef(false)

  const verts = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }]
  let edgePath: string
  let labelX: number
  let labelY: number
  if (points.length === 0) {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: sourcePosition ?? Position.Bottom,
      targetPosition: targetPosition ?? Position.Top,
    })
    edgePath = p
    labelX = lx
    labelY = ly
  } else {
    edgePath = verts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const mid = verts[Math.floor(verts.length / 2)]
    labelX = mid.x
    labelY = mid.y
  }

  // 対象 edge の data.points だけを差し替える（他 edge は再描画しない）
  const writeLocal = (next: EdgePoint[]) => {
    latest.current = next
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, data: { ...(e.data as object), points: next } } : e)))
  }

  // 既存 waypoint の移動
  const startMove = (idx: number, base: EdgePoint[]) => (ev: ReactPointerEvent) => {
    ev.stopPropagation()
    moved.current = false
    const move = (e: PointerEvent) => {
      moved.current = true
      const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      writeLocal(base.map((p, i) => (i === idx ? { x: Math.round(fp.x), y: Math.round(fp.y) } : p)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (moved.current) commitPoints(id, latest.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // セグメント中点のゴースト → 新規 waypoint を挿入し、そのままドラッグに移行
  const startInsert = (segIndex: number) => (ev: ReactPointerEvent) => {
    const fp = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
    const inserted = [...points]
    inserted.splice(segIndex, 0, { x: Math.round(fp.x), y: Math.round(fp.y) })
    writeLocal(inserted)
    startMove(segIndex, inserted)(ev)
  }

  // waypoint ダブルクリックで削除
  const removeAt = (idx: number) => (ev: ReactMouseEvent) => {
    ev.stopPropagation()
    const next = points.filter((_, i) => i !== idx)
    writeLocal(next)
    commitPoints(id, next)
  }

  return (
    <>
      {/* 選択中は線の下にハローを敷き、脈動させて、複数選択でもどの線が選ばれているか分かるようにする */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="var(--palace)"
          strokeWidth={(s.width || 2) + 6}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        >
          <animate attributeName="stroke-opacity" values="0.1;0.8;0.1" dur="0.8s" repeatCount="indefinite" />
        </path>
      )}
      <BaseEdge id={id} path={edgePath} markerStart={markerStart} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {label && (
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              // 背景色を指定していなくても、線や他のカードに重なると読めなくなる。
              // 盤の色に馴染む下地を必ず敷き、細い縁で切り分ける
              background: s.label_bg || 'var(--board-bg)',
              color: s.label_color || undefined,
              fontSize: s.label_size || 13,
              opacity: s.label_opacity != null ? s.label_opacity / 100 : undefined,
              padding: '2px 6px',
              borderRadius: 4,
              border: s.label_bg ? undefined : '1px solid rgba(0,0,0,0.08)',
              boxShadow: s.label_bg ? undefined : '0 1px 2px rgba(0,0,0,0.06)',
              lineHeight: 1.3,
              textAlign: 'center',
              writingMode: s.label_vertical ? 'vertical-rl' : undefined,
              whiteSpace: s.label_vertical ? 'nowrap' : undefined,
            }}
          >
            {label}
          </div>
        )}

        {selected && (
          <>
            {/* セグメント中点のゴースト（ドラッグで折れ点を追加） */}
            {verts.slice(0, -1).map((v, i) => {
              const n = verts[i + 1]
              const mx = (v.x + n.x) / 2
              const my = (v.y + n.y) / 2
              return (
                <div
                  key={`g${i}`}
                  className="nodrag nopan"
                  onPointerDown={startInsert(i)}
                  title="ドラッグで折れ点を追加"
                  style={{
                    position: 'absolute',
                    transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--palace)',
                    opacity: 0.4,
                    cursor: 'crosshair',
                    pointerEvents: 'all',
                  }}
                />
              )
            })}
            {/* 既存 waypoint（ドラッグで移動 / ダブルクリックで削除） */}
            {points.map((p, i) => (
              <div
                key={`w${i}`}
                className="nodrag nopan"
                onPointerDown={startMove(i, points)}
                onDoubleClick={removeAt(i)}
                title="ドラッグで移動 / ダブルクリックで削除"
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '2px solid var(--palace)',
                  cursor: 'grab',
                  pointerEvents: 'all',
                }}
              />
            ))}
          </>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const EditableEdge = memo(EditableEdgeComponent)
