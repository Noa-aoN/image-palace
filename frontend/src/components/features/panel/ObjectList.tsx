'use client'

import { useEffect, useState } from 'react'
import { Spline, GripVertical } from 'lucide-react'
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
import { getViewDetail, reorderViewEdges } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { ViewEdge } from '@/types/view'
import { persist } from '@/lib/api/persist'

// 一覧の1行（ドラッグハンドル＋クリックで接続線編集）。
function SortableRow({ edge, onSelect }: { edge: ViewEdge; onSelect: (edge: ViewEdge) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: edge.id })
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
        <button type="button" onClick={() => onSelect(edge)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"
            style={{ color: edge.style?.color || 'var(--foreground)' }}
          >
            <Spline size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{edge.label?.trim() || '接続線'}</span>
        </button>
      </div>
    </li>
  )
}

// 右パネル: ボード上のオブジェクト（接続線・将来の図形/テキスト）一覧。上ほど手前（レイヤー）。
// クリックでそれぞれの設定へ、ドラッグで重なり順（z_index）を並べ替える。
export function ObjectList({ viewId }: { viewId: string }) {
  const openEdge = useRightPanelStore((s) => s.openEdge)
  const requestFocusEdge = useRightPanelStore((s) => s.requestFocusEdge)
  // 手前を先頭に表示する（取得は z_index 昇順＝奥→手前なので反転）
  const [edges, setEdges] = useState<ViewEdge[] | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    let cancelled = false
    getViewDetail(viewId)
      .then((v) => {
        if (!cancelled) setEdges([...(v.edges ?? [])].reverse())
      })
      .catch(() => {
        if (!cancelled) setEdges([])
      })
    return () => {
      cancelled = true
    }
  }, [viewId])

  if (edges === null) return <p className="text-xs text-muted-foreground">読み込み中…</p>
  if (edges.length === 0) {
    return <p className="text-xs text-muted-foreground">まだオブジェクトがありません。カード同士をつないで接続線を作れます。</p>
  }

  const select = (edge: ViewEdge) => {
    openEdge(viewId, edge)
    requestFocusEdge(edge.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = edges.findIndex((e) => e.id === active.id)
    const newIndex = edges.findIndex((e) => e.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(edges, oldIndex, newIndex)
    setEdges(next)
    // 先頭＝手前。サーバへ順序を永続化（開いているボードは再読込時に反映）。
    persist(() => reorderViewEdges(viewId, next.map((e) => e.id)), { key: `view:${viewId}:edgeOrder` })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={edges.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {edges.map((e) => (
            <SortableRow key={e.id} edge={e} onSelect={select} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
