'use client'

import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react'
import type { ViewEdgeStyle } from '@/types/view'

// フリーボードの接続線。パスは smoothstep（自動ルーティング）、ラベルは HTML で描画する。
// HTML ラベルにすることで、背景色が文字サイズに自動フィット（蛍光マーカー風）・中央寄せ・縦書きに対応できる。
// （フェーズBで waypoints 編集を本コンポーネントに追加する）
type EditableEdgeData = { edgeStyle?: ViewEdgeStyle; label?: string | null }

function EditableEdgeComponent(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerStart, markerEnd, style } = props
  const d = (props.data ?? {}) as EditableEdgeData
  const s = d.edgeStyle ?? {}
  const label = d.label

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Bottom,
    targetPosition: targetPosition ?? Position.Top,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerStart={markerStart} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            // クリックは背後のパス（onEdgeClick）に通す。表示専用。
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              // 背景は文字に自動フィット（絶対配置＋インライン内容で幅は内容依存）
              background: s.label_bg || undefined,
              color: s.label_color || undefined,
              fontSize: s.label_size || 13,
              opacity: s.label_opacity != null ? s.label_opacity / 100 : undefined,
              padding: s.label_bg ? '2px 6px' : 0,
              borderRadius: 4,
              lineHeight: 1.3,
              textAlign: 'center',
              writingMode: s.label_vertical ? 'vertical-rl' : undefined,
              whiteSpace: s.label_vertical ? 'nowrap' : undefined,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const EditableEdge = memo(EditableEdgeComponent)
