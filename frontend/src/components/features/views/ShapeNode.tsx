'use client'

import { memo } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { BoardShape, BoardShapeKind } from '@/types/view'

export type ShapeNodeData = { shape: BoardShape }
export type ShapeNodeType = Node<ShapeNodeData, 'shape'>

/** 読める大きさの下限。カードと同じ考え方（読めないほど小さくしない） */
export const SHAPE_MIN_W = 40
export const SHAPE_MIN_H = 40

/**
 * ボードに置く図形。
 *
 * ## カードと違うところ
 *
 * カードは「中身が主役」で、枠は入れ物にすぎない。
 * 図形は**枠そのものが意味を持つ**（囲む・区切る・強調する）。
 * だから塗りと枠線を持ち、中の文字は添え物として扱う。
 *
 * ## かこみ（frame）だけ扱いが違う
 *
 * **中を素通しにする。** 掴めるようにすると、囲ったカードを触ろうとして
 * かこみを掴んでしまう。縁と見出しだけを掴めるようにする。
 */
export const ShapeNode = memo(function ShapeNode({ data, selected }: NodeProps<ShapeNodeType>) {
  const { kind, text, style } = data.shape
  const isFrame = kind === 'frame'

  return (
    <>
      <NodeResizer
        isVisible
        minWidth={SHAPE_MIN_W}
        minHeight={SHAPE_MIN_H}
        lineClassName="!border-transparent"
      />
      <div
        className={`h-full w-full ${isFrame ? 'pointer-events-none' : ''}`}
        style={{ opacity: style.opacity ?? 1 }}
      >
        <div className="relative h-full w-full" style={surfaceStyle(kind, style)}>
          {/* かこみの見出しは**枠の外**（上）に置く。中に置くとカードと重なる */}
          {isFrame && text && (
            <span className="pointer-events-auto absolute -top-6 left-0 max-w-full truncate text-sm font-medium"
                  style={{ color: style.text_color ?? 'var(--ink-soft)' }}>
              {text}
            </span>
          )}

          {!isFrame && text && (
            <div
              className="flex h-full w-full items-center overflow-hidden whitespace-pre-wrap break-words p-3"
              style={{
                justifyContent: alignmentOf(style.align),
                textAlign: style.align ?? 'left',
                fontSize: style.font_size ?? 15,
                fontWeight: style.bold ? 600 : 400,
                color: style.text_color ?? 'var(--ink-body)',
              }}
            >
              {text}
            </div>
          )}
        </div>
      </div>
      {selected && (
        <span className="pointer-events-none absolute -top-5 right-0 text-2xs text-muted-foreground">
          {KIND_LABELS[kind]}
        </span>
      )}
    </>
  )
})

const KIND_LABELS: Record<BoardShapeKind, string> = {
  rectangle: '四角',
  ellipse: '丸',
  sticky: '付箋',
  text: '文字',
  frame: 'かこみ',
}

/**
 * 種類ごとの見た目。
 *
 * **文字だけ（text）は塗りも枠も持たない。** 持たせると、
 * 見出しを置くたびに背景を消す手間が要る。
 */
function surfaceStyle(kind: BoardShapeKind, style: BoardShape['style']): React.CSSProperties {
  if (kind === 'text') return {}

  const stroke = style.stroke
  const width = style.stroke_width ?? (kind === 'frame' ? 2 : 0)

  return {
    backgroundColor: style.fill ?? defaultFill(kind),
    border: stroke && width > 0 ? `${width}px ${style.dashed ? 'dashed' : 'solid'} ${stroke}` : undefined,
    borderRadius: kind === 'ellipse' ? '50%' : `${style.radius ?? (kind === 'sticky' ? 4 : 8)}px`,
    // 付箋は貼ったものらしく、薄い影を落とす
    boxShadow: kind === 'sticky' ? '0 1px 3px rgba(0,0,0,0.12)' : undefined,
    height: '100%',
    width: '100%',
  }
}

/** 塗りの既定。**かこみは中身が透けないと囲えない** */
function defaultFill(kind: BoardShapeKind): string | undefined {
  if (kind === 'frame') return undefined
  if (kind === 'sticky') return '#FFF3B0'
  return 'var(--card)'
}

function alignmentOf(align: BoardShape['style']['align']): string {
  if (align === 'center') return 'center'
  if (align === 'right') return 'flex-end'
  return 'flex-start'
}
