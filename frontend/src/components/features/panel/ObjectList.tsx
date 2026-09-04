'use client'

import { useEffect, useState } from 'react'
import { Spline, GripVertical, Square, Circle, StickyNote, Type, Frame } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getViewDetail, reorderViewEdges, reorderViewShapes } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { BoardShape, BoardShapeKind, ViewEdge } from '@/types/view'
import { persist } from '@/lib/api/persist'

/**
 * 右パネル: ボードに置いてあるものの一覧。上ほど手前（レイヤー）。
 *
 * ## 図形と接続線を分けて並べる理由
 *
 * ひとつの表にしたいところだが、**両者は別の層に描かれる**。
 * 図形はカードと同じ面に、接続線はその下の面に置かれるので、
 * 「図形を接続線の後ろへ」という並べ替えは、そもそも効かない。
 *
 * 混ぜて並べれば操作はできるが、**掴んで動かしても何も起きない**行ができる。
 * できないことを、できるように見せない。群ごとに分けて、
 * それぞれの中で並べ替えられるようにする。
 */

type ShapeRow = { kind: 'shape'; shape: BoardShape }
type EdgeRow = { kind: 'edge'; edge: ViewEdge }
type Row = ShapeRow | EdgeRow

const rowId = (row: Row) => (row.kind === 'shape' ? row.shape.id : row.edge.id)

const SHAPE_ICONS: Record<BoardShapeKind, typeof Square> = {
  rectangle: Square,
  ellipse: Circle,
  sticky: StickyNote,
  text: Type,
  frame: Frame,
}

const SHAPE_LABELS: Record<BoardShapeKind, string> = {
  rectangle: '四角',
  ellipse: '丸',
  sticky: '付箋',
  text: '文字',
  frame: 'かこみ',
}

// 一覧の1行（ドラッグハンドル＋クリックで設定を開く）。
function SortableRow({ row, onSelect }: { row: Row; onSelect: (row: Row) => void }) {
  const id = rowId(row)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const shape = row.kind === 'shape' ? row.shape : null
  const Icon = shape ? SHAPE_ICONS[shape.kind] : Spline
  // 図形は塗りの色でそれと分かるようにする。塗りが無いものは枠の色を使う
  const edge = row.kind === 'edge' ? row.edge : null
  const tint = shape ? (shape.style.fill ?? shape.style.stroke ?? undefined) : edge?.style?.color
  const name = shape ? shape.text?.trim() || SHAPE_LABELS[shape.kind] : edge?.label?.trim() || '接続線'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-80' : undefined}
    >
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-muted">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="ドラッグして重なり順を変更"
          className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={() => onSelect(row)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"
            style={{ color: tint || 'var(--foreground)' }}
          >
            <Icon size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
          {/* 名前が中の文字になっている図形は、種類が読めなくなるので添える */}
          {shape?.text?.trim() && (
            <span className="shrink-0 text-2xs text-muted-foreground">{SHAPE_LABELS[shape.kind]}</span>
          )}
        </button>
      </div>
    </li>
  )
}

// 群ひとつ（図形どうし・接続線どうし）。この中でだけ並べ替えられる
function Group({
  title,
  rows,
  onSelect,
  onReorder,
}: {
  title: string
  rows: Row[]
  onSelect: (row: Row) => void
  onReorder: (rows: Row[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => rowId(r) === active.id)
    const newIndex = rows.findIndex((r) => rowId(r) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(rows, oldIndex, newIndex))
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-medium text-muted-foreground">{title}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map(rowId)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <SortableRow key={rowId(row)} row={row} onSelect={onSelect} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export function ObjectList({ viewId }: { viewId: string }) {
  const openEdge = useRightPanelStore((s) => s.openEdge)
  const openShape = useRightPanelStore((s) => s.openShape)
  const requestFocusEdge = useRightPanelStore((s) => s.requestFocusEdge)
  // 手前を先頭に表示する（取得は z_index 昇順＝奥→手前なので反転）
  const [shapes, setShapes] = useState<ShapeRow[] | null>(null)
  const [edges, setEdges] = useState<EdgeRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getViewDetail(viewId)
      .then((v) => {
        if (cancelled) return
        setShapes([...(v.shapes ?? [])].reverse().map((shape) => ({ kind: 'shape', shape })))
        setEdges([...(v.edges ?? [])].reverse().map((edge) => ({ kind: 'edge', edge })))
      })
      .catch(() => {
        if (cancelled) return
        setShapes([])
        setEdges([])
      })
    return () => {
      cancelled = true
    }
  }, [viewId])

  if (shapes === null || edges === null) return <p className="text-xs text-muted-foreground">読み込み中…</p>

  if (shapes.length === 0 && edges.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        まだオブジェクトがありません。カード同士をつないで接続線を作るか、ツールバーの「図形」から置けます。
      </p>
    )
  }

  const select = (row: Row) => {
    if (row.kind === 'shape') {
      openShape(viewId, row.shape)
      return
    }
    openEdge(viewId, row.edge)
    requestFocusEdge(row.edge.id)
  }

  return (
    <div className="space-y-4">
      <Group
        title="図形"
        rows={shapes}
        onSelect={select}
        onReorder={(rows) => {
          const next = rows as ShapeRow[]
          setShapes(next)
          // 先頭＝手前。開いているボードには再読込時に反映される
          persist(() => reorderViewShapes(viewId, next.map((r) => r.shape.id)), {
            key: `view:${viewId}:shapeOrder`,
          })
        }}
      />
      <Group
        title="接続線"
        rows={edges}
        onSelect={select}
        onReorder={(rows) => {
          const next = rows as EdgeRow[]
          setEdges(next)
          persist(() => reorderViewEdges(viewId, next.map((r) => r.edge.id)), {
            key: `view:${viewId}:edgeOrder`,
          })
        }}
      />
    </div>
  )
}
