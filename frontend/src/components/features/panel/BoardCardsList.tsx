'use client'

import { useEffect, useState } from 'react'
import { GripVertical } from 'lucide-react'
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
import { getViewDetail, reorderBoardLayers } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { ViewItemPlacement } from '@/types/view'
import { persist } from '@/lib/api/persist'

// 一覧の1行（ドラッグハンドル＋クリックで詳細）。行全体はクリック可能、ハンドルのみドラッグ。
function SortableRow({ vi, onSelect }: { vi: ViewItemPlacement; onSelect: (itemId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: vi.item_id })
  const url = vi.item.media?.thumb_url ?? vi.item.media?.url ?? null
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-80' : undefined}
    >
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 transition-colors hover:bg-muted">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="ドラッグして重なり順を変更"
          className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={() => onSelect(vi.item_id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={vi.item.title} className="h-full w-full object-cover" loading="lazy" />
            ) : null}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{vi.item.title}</span>
        </button>
      </div>
    </li>
  )
}

// 右パネル: ボードに配置済みのカード一覧。上ほど手前（レイヤー）。
// クリックで詳細＋該当カードへパン、ドラッグで重なり順（z_index）を並べ替える。
export function BoardCardsList({ viewId }: { viewId: string }) {
  const openCard = useRightPanelStore((s) => s.openCard)
  const requestFocus = useRightPanelStore((s) => s.requestFocus)
  const requestLayerPatch = useRightPanelStore((s) => s.requestLayerPatch)
  // 手前を先頭に表示する（取得は z_index 昇順＝奥→手前なので反転）
  const [items, setItems] = useState<ViewItemPlacement[] | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    let cancelled = false
    getViewDetail(viewId)
      .then((v) => {
        if (!cancelled) setItems([...(v.items ?? [])].reverse())
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [viewId])

  if (items === null) return <p className="text-xs text-muted-foreground">読み込み中…</p>
  // 「ありません」で終わらせない。ここから何をすればよいかを添える
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        まだカードがありません。上の「追加」→「カードを追加」から、この板に置くカードを選べます。
      </p>
    )
  }

  const select = (itemId: string) => {
    openCard(itemId, viewId)
    requestFocus(itemId)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.item_id === active.id)
    const newIndex = items.findIndex((i) => i.item_id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    // 先頭＝手前＝最大 z。ボードへ即時反映＋サーバへ順序を永続化。
    const frontToBack = next.map((i) => i.item_id)
    requestLayerPatch(frontToBack.map((id, idx) => ({ id, z: next.length - idx })))
    persist(() => reorderBoardLayers(viewId, frontToBack), { key: `view:${viewId}:layers` })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.item_id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {items.map((vi) => (
            <SortableRow key={vi.item_id} vi={vi} onSelect={select} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
