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
import { getViewDetail, reorderViewObjects } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { BoardShape, BoardShapeKind, ViewEdge } from '@/types/view'
import { persist } from '@/lib/api/persist'

/**
 * 右パネル: ボードに置いてあるものの一覧。上ほど手前（レイヤー）。
 *
 * ## ひとつの並びにした理由
 *
 * はじめは図形と接続線を分けて並べていた。別の層に描かれるものだと思っていたためだが、
 * 調べると **React Flow はどちらも同じ重なりの空間に置いていた**
 * （線は1本ずつ `<svg style="z-index">` として、カードと同じ入れ物の中に描かれる）。
 *
 * 分けている必要は無く、分けているせいで**「線の上に付箋を置く」ができなかった**。
 * 描く道具として見れば、線も図形も同じ「盤に置いたもの」で、前後があるのが自然。
 *
 * かこみ（frame）だけは並びの外にいる。必ずいちばん後ろに敷く
 * （前に出ると囲った中身が隠れる）。一覧には出すが、他より前へは行かない。
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

export function ObjectList({ viewId }: { viewId: string }) {
  const openEdge = useRightPanelStore((s) => s.openEdge)
  const openShape = useRightPanelStore((s) => s.openShape)
  const requestFocusEdge = useRightPanelStore((s) => s.requestFocusEdge)
  // 手前を先頭に表示する（取得は z_index 昇順＝奥→手前なので反転）
  const [rows, setRows] = useState<Row[] | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    let cancelled = false
    getViewDetail(viewId)
      .then((v) => {
        if (cancelled) return
        setRows(mergeRows(v.shapes ?? [], v.edges ?? []))
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [viewId])

  if (rows === null) return <p className="text-xs text-muted-foreground">読み込み中…</p>

  if (rows.length === 0) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => rowId(r) === active.id)
    const newIndex = rows.findIndex((r) => rowId(r) === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(rows, oldIndex, newIndex)
    setRows(next)
    // 先頭＝手前。開いているボードには再読込時に反映される
    persist(
      () =>
        reorderViewObjects(
          viewId,
          next.map((row) => ({ kind: row.kind, id: rowId(row) }))
        ),
      { key: `view:${viewId}:objectOrder` }
    )
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map(rowId)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <SortableRow key={rowId(row)} row={row} onSelect={select} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="text-2xs text-muted-foreground">
        上ほど手前。掴んで入れ替えると、線と図形の前後が変わります。
      </p>
    </div>
  )
}

/**
 * 図形と接続線を、ひとつの並びにまとめる。
 *
 * どちらも `z_index` は同じ意味（大きいほど手前）なので、その数で並べられる。
 * 同じ数のときは図形を手前に置く（**あとから置いたものが上**という感覚に合う）。
 */
function mergeRows(shapes: BoardShape[], edges: ViewEdge[]): Row[] {
  const all: Row[] = [
    ...shapes.map((shape): Row => ({ kind: 'shape', shape })),
    ...edges.map((edge): Row => ({ kind: 'edge', edge })),
  ]
  return all.sort((a, b) => {
    const gap = zOf(b) - zOf(a)
    return gap !== 0 ? gap : rankOf(a) - rankOf(b)
  })
}

const zOf = (row: Row) => (row.kind === 'shape' ? row.shape.z_index : (row.edge.z_index ?? 0))
const rankOf = (row: Row) => (row.kind === 'shape' ? 0 : 1)
