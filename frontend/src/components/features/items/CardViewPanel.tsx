'use client'

import { useState } from 'react'
import { Eye, EyeOff, GripVertical, Minus, Plus } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { updateBlockView } from '@/lib/api/items'
import type { Item } from '@/types/item'

export const CARD_VIEW_PANEL_KEY = 'item-card-view'

/** 並べ替え・表示切替の対象になるブロック1つぶん */
export interface CardBlock {
  key: string
  label: string
}

/**
 * このカードの見え方。**この1枚だけ**に効く。
 *
 * 段は2つ。
 *   ＋ … このカードが持つ項目。並べ替えと、出す/畳むの切替ができる
 *   −  … このカードでは持たない項目。出さないうえ、AI の穴埋めの対象からも外れる
 *
 * 「持たない」と「畳む」を分けているのは、意味が違うため。
 * 人物のカードに読み仮名は要らない（＝持たない）が、意味・説明は持っていて
 * いまは畳んでおきたい、ということがある。どちらも見えないので、
 * 一段にまとめると区別が付かなくなる。
 *
 * 「項目の設定」（種別ぜんぶに効く）とは混ぜない。あちらは項目そのものの定義。
 */
export function CardViewPanel({
  item,
  blocks,
  omitted,
  onUpdated,
}: {
  item: Item
  /** ＋ の段（並べ替え適用後） */
  blocks: CardBlock[]
  /** − の段（このカードでは持たない項目） */
  omitted: CardBlock[]
  onUpdated: (item: Item) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hidden = new Set(item.block_view?.hidden ?? [])
  const omittedKeys = new Set(item.block_view?.omitted ?? [])
  // 4px 動かすまでは並べ替えを始めない。表示の入り切りを押すだけのつもりが
  // 指が滑って並びまで変わる、を防ぐ
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const save = async (nextHidden: string[], nextOrder: string[], nextOmitted: string[]) => {
    setBusy(true)
    setError(null)
    try {
      onUpdated(await updateBlockView(item.id, { hidden: nextHidden, order: nextOrder, omitted: nextOmitted }))
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  const order = blocks.map((b) => b.key)

  const toggle = (key: string) => {
    const next = hidden.has(key) ? [...hidden].filter((k) => k !== key) : [...hidden, key]
    save(next, order, [...omittedKeys])
  }

  // − へ落とす。畳んでいた印も外す（戻したときに、なぜか見えない状態にしない）
  const omit = (key: string) =>
    save([...hidden].filter((k) => k !== key), order.filter((k) => k !== key), [...omittedKeys, key])

  // ＋ へ戻す。並びの末尾に付ける（元の位置は覚えていない）
  const adopt = (key: string) =>
    save([...hidden], [...order, key], [...omittedKeys].filter((k) => k !== key))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = blocks.findIndex((b) => b.key === active.id)
    const to = blocks.findIndex((b) => b.key === over.id)
    if (from < 0 || to < 0) return

    save([...hidden], arrayMove(blocks, from, to).map((b) => b.key), [...omittedKeys])
  }

  return (
    <PanelSlotContent sectionKey={CARD_VIEW_PANEL_KEY}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          このカード1枚だけの見え方です。<strong className="text-foreground">＋</strong> は持つ項目、
          <strong className="text-foreground">−</strong> は持たない項目。
          どちらに置いても中身は消えません。
          <br />
          項目そのものを増やすのは「項目の設定」です（そちらは種別ぜんぶに効きます）。
        </p>

        <p className="text-xs font-medium">＋ このカードが持つ項目</p>

        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">ありません。下の − から戻せます。</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {blocks.map((block) => (
                  <SortableRow
                    key={block.key}
                    block={block}
                    hidden={hidden.has(block.key)}
                    busy={busy}
                    onToggle={() => toggle(block.key)}
                    onOmit={() => omit(block.key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <p className="pt-1 text-xs font-medium">− このカードでは持たない項目</p>
        {omitted.length === 0 ? (
          <p className="text-xs text-muted-foreground">ありません。</p>
        ) : (
          <div className="space-y-1.5">
            {omitted.map((block) => (
              <div
                key={block.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2"
              >
                <span className="truncate text-sm text-muted-foreground">{block.label}</span>
                <Tooltip label="この項目を持つ">
                  <button
                    type="button"
                    onClick={() => adopt(block.key)}
                    disabled={busy}
                    aria-label={`${block.label}を持つ`}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <Plus size={15} />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner size={12} />
            保存中…
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </PanelSlotContent>
  )
}

function SortableRow({
  block,
  hidden,
  busy,
  onToggle,
  onOmit,
}: {
  block: CardBlock
  hidden: boolean
  busy: boolean
  onToggle: () => void
  onOmit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.key })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 ${
        isDragging ? 'opacity-60 shadow-md' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* つまみは持つところを分ける。行そのものを掴めるようにすると、
            表示の入り切りを押したいだけのときに動いてしまう */}
        <Tooltip label="ドラッグで並べ替え">
          <button
            type="button"
            aria-label={`${block.label}を並べ替え`}
            className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={15} />
          </button>
        </Tooltip>
        <span className={`truncate text-sm ${hidden ? 'text-muted-foreground line-through' : ''}`}>
          {block.label}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <Tooltip label={hidden ? '出す' : '畳む'}>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-label={hidden ? `${block.label}を出す` : `${block.label}を畳む`}
            className="transition-colors hover:text-foreground disabled:opacity-30"
          >
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </Tooltip>
        <Tooltip label="この項目を持たない">
          <button
            type="button"
            onClick={onOmit}
            disabled={busy}
            aria-label={`${block.label}を持たない`}
            className="transition-colors hover:text-foreground disabled:opacity-30"
          >
            <Minus size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

/**
 * 既定の並びに、このカードの指定を当てる。
 * 指定に無いブロック（あとから増えた項目）は、既定の位置のまま後ろへ残す。
 */
export function applyBlockOrder<T extends { key: string }>(blocks: T[], order: string[] | undefined): T[] {
  if (!order || order.length === 0) return blocks

  const rank = new Map(order.map((key, index) => [key, index]))
  return [...blocks].sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity))
}
