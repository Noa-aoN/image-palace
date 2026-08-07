'use client'

import { useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import {
  PROPERTY_VALUE_TYPES,
  PROPERTY_VALUE_TYPE_LABELS,
  PROPERTY_PRESETS,
  suggestPropertyKey,
  createPropertyDefinition,
  deletePropertyDefinition,
  reorderPropertyDefinitions,
  type PropertyDefinition,
  type PropertyValueType,
} from '@/lib/api/properties'
import type { ItemType } from '@/types/item'

/**
 * 1つの種別ぶんの項目一覧。環境設定のページと、カード詳細の右パネルで同じものを使う。
 *
 * 効く範囲はどちらから触っても同じ（その種別のカード全部）。
 * 触れる場所が2つあるだけで、意味が変わらないようにしている。
 */
export function CardPropertiesEditor({
  itemType,
  definitions,
  onChanged,
}: {
  itemType: ItemType
  definitions: PropertyDefinition[]
  onChanged: () => void | Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [valueType, setValueType] = useState<PropertyValueType>('text')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const usedKeys = new Set(definitions.map((d) => d.key))

  const add = async (payload: { key: string; label: string; value_type: PropertyValueType }) => {
    setBusy(true)
    setError(null)
    try {
      await createPropertyDefinition({ item_type_id: itemType.id, ...payload })
      await onChanged()
      setAdding(false)
      setLabel('')
      setKey('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[]; error?: string } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? axiosErr?.response?.data?.error ?? '追加できませんでした')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (definition: PropertyDefinition) => {
    setBusy(true)
    setError(null)
    try {
      await deletePropertyDefinition(definition.id)
      await onChanged()
    } catch {
      setError('削除できませんでした')
    } finally {
      setBusy(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = definitions.findIndex((d) => d.id === active.id)
    const to = definitions.findIndex((d) => d.id === over.id)
    if (from < 0 || to < 0) return

    setBusy(true)
    setError(null)
    try {
      await reorderPropertyDefinitions(arrayMove(definitions, from, to).map((d) => d.id))
      await onChanged()
    } catch {
      setError('並び替えられませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{itemType.label}</h2>
        <span className="text-xs text-muted-foreground">{definitions.length} 項目</span>
      </div>

      {definitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">項目はまだありません。</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={definitions.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {definitions.map((definition) => (
                <SortableDefinition
                  key={definition.id}
                  definition={definition}
                  busy={busy}
                  onRemove={() => remove(definition)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!adding ? (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus size={14} />
            項目を追加
          </button>
          <p className="text-xs text-muted-foreground">よく使う項目から選ぶ</p>
          {PROPERTY_PRESETS.map((preset) => (
            <div key={preset.group} className="space-y-1">
              <p className="text-[11px] text-muted-foreground">{preset.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {preset.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => add(item)}
                    disabled={busy || usedKeys.has(item.key)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    title={usedKeys.has(item.key) ? '追加済み' : PROPERTY_VALUE_TYPE_LABELS[item.value_type]}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`label-${itemType.id}`}>名前</Label>
            <input
              id={`label-${itemType.id}`}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                if (!key) setKey(suggestPropertyKey(e.target.value))
              }}
              disabled={busy}
              autoFocus
              placeholder="例: 読み仮名"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`key-${itemType.id}`}>識別名（英字）</Label>
            <input
              id={`key-${itemType.id}`}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={busy}
              placeholder="reading"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              英小文字・数字・アンダースコア。あとから変えられません（入っている値が辿れなくなるため）。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>型</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_VALUE_TYPES.map((type) => {
                const active = valueType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setValueType(type)}
                    disabled={busy}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                      active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                  >
                    {PROPERTY_VALUE_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => add({ key: key.trim(), label: label.trim(), value_type: valueType })}
              disabled={busy || !label.trim() || !key.trim()}
            >
              {busy ? <Spinner size={14} /> : '追加'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={busy}>
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function SortableDefinition({
  definition,
  busy,
  onRemove,
}: {
  definition: PropertyDefinition
  busy: boolean
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: definition.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 ${
        isDragging ? 'opacity-60 shadow-md' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip label="ドラッグで並べ替え">
          <button
            type="button"
            aria-label={`${definition.label}を並べ替え`}
            className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={15} />
          </button>
        </Tooltip>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{definition.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {PROPERTY_VALUE_TYPE_LABELS[definition.value_type]} / {definition.key}
          </p>
        </div>
      </div>
      <Tooltip label="削除">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`${definition.label}を削除`}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <Trash2 size={14} />
        </button>
      </Tooltip>
    </div>
  )
}
