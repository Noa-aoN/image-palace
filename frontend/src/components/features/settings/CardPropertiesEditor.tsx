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
  PROPERTY_VALUE_TYPE_NOTES,
  PROPERTY_VALUE_TYPE_LABELS,
  PROPERTY_PRESETS,
  suggestPropertyKey,
  createPropertyDefinition,
  deletePropertyDefinition,
  updatePropertyDefinition,
  reorderPropertyDefinitions,
  PROPERTY_COLORS,
  propertyColorOf,
  type PropertyDefinition,
  type PropertyValueType,
  PROPERTY_CATEGORIES,
  type PropertyCategory,
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
  // 何のために持つ項目か。既定は「その語のこと」
  const [category, setCategory] = useState<PropertyCategory>('subject')
  const [busy, setBusy] = useState(false)
  // 選ぶ項目の選択肢。1行に1つ書いてもらう
  const [options, setOptions] = useState('')
  // 空行と前後の空白は落とす。**同じものも1つにまとめる**（サーバーも同じ決まり）
  const optionList = [...new Set(options.split('\n').map((o) => o.trim()).filter(Boolean))]
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const usedKeys = new Set(definitions.map((d) => d.key))

  /**
   * 足すときの鍵。
   *
   * 自由欄は同じものを何枚も置くので、既にあれば番号を振る（free, free_2, free_3…）。
   * **鍵はあとから変えられない**ので、ここで衝突しない形にしておく。
   */
  const nextKey = (item: { key: string; value_type: PropertyValueType }) => {
    if (item.value_type !== 'free_text' || !usedKeys.has(item.key)) return item.key

    let n = 2
    while (usedKeys.has(`${item.key}_${n}`)) n += 1
    return `${item.key}_${n}`
  }

  const add = async (payload: {
    key: string
    label: string
    value_type: PropertyValueType
    category?: PropertyCategory
    options?: string[]
  }) => {
    setBusy(true)
    setError(null)
    try {
      await createPropertyDefinition({ item_type_id: itemType.id, ...payload })
      await onChanged()
      setAdding(false)
      setLabel('')
      setKey('')
      setOptions('')
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

  /**
   * 目印の色を付け替える。
   *
   * **その種別のカード全部に効く。** ここは項目の設定なので、
   * 1枚のカードから触れる場所には置かない（「このカードだけ」と誤読される）。
   */
  const setColor = async (definition: PropertyDefinition, color: string | null) => {
    setBusy(true)
    setError(null)
    try {
      // 外すときは空文字で送る。null をそのまま送ると、送っていないのと区別が付かない
      await updatePropertyDefinition(definition.id, { color: color ?? '' })
      await onChanged()
    } catch {
      setError('色を変えられませんでした')
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
        // 「ありません」で終わらせない。何ができるようになるかを添える。
        // 案内する先は、実際にこの画面にあるものだけにする
        <p className="text-sm text-muted-foreground">
          項目はまだありません。下の「よく使う項目から選ぶ」か「自分で決めて足す」から作れます。
          作った項目は、カード一覧の「表示」で出す項目としても選べます。
        </p>
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
                  onColorChange={(color) => setColor(definition, color)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!adding ? (
        <div className="space-y-3 border-t border-border/60 pt-3">
          {/* 足し方は2つある。用意したものから選ぶのと、自分で決めるの。
              並べて出さないと、字だけのリンク（自分で決める）が
              札の群れに埋もれて、選ぶ道しかないように見える */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium">よく使う項目から選ぶ</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              className="flex h-7 items-center gap-1 px-2.5 text-xs"
            >
              <Plus size={13} />
              自分で決めて足す
            </Button>
          </div>
          {PROPERTY_PRESETS.map((preset) => (
            <div key={preset.group} className="space-y-1">
              <p className="text-[11px] text-muted-foreground">{preset.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {preset.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => add({ ...item, key: nextKey(item), category: preset.category })}
                    // 自由欄は何枚でも足せる（見出しを定義側で決めないため）
                    disabled={busy || (item.value_type !== 'free_text' && usedKeys.has(item.key))}
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
          {/* 役割を先に決める。**型より先に効く**（覚えかたの項目は、
              合っているかより思い出せるかで直すので、見分けが付く必要がある） */}
          <div className="space-y-1.5">
            <Label>大別</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_CATEGORIES.map((row) => {
                const active = category === row.key
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setCategory(row.key)}
                    disabled={busy}
                    aria-pressed={active}
                    title={row.hint}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                      active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={active ? { backgroundColor: row.accent } : undefined}
                  >
                    {row.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {PROPERTY_CATEGORIES.find((row) => row.key === category)?.hint}
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
            {/* 型によっては、選んだ瞬間に何が起きるのかが名前から読み取れない。
                「Wikipedia」は手で書く欄ではなく、引いてきた結果が入る欄なので、そう書く */}
            {PROPERTY_VALUE_TYPE_NOTES[valueType] && (
              <p className="text-xs text-muted-foreground">{PROPERTY_VALUE_TYPE_NOTES[valueType]}</p>
            )}
          </div>

          {/* **選ぶ項目だけ、何を選べるかが要る。**
              空のまま作れると、開いても選べない欄になる */}
          {valueType === 'select' && (
            <div className="space-y-1">
              <Label htmlFor="property-options">選択肢</Label>
              <textarea
                id="property-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={3}
                placeholder={'下書き\n確認待ち\n完成'}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                1行に1つ書きます（20個まで）。あとから足したり並べ替えたりできます。
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                add({
                  key: key.trim(),
                  label: label.trim(),
                  value_type: valueType,
                  category,
                  ...(valueType === 'select' ? { options: optionList } : {}),
                })
              }
              disabled={busy || !label.trim() || !key.trim() || (valueType === 'select' && optionList.length === 0)}
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
  onColorChange,
}: {
  definition: PropertyDefinition
  busy: boolean
  onRemove: () => void
  onColorChange: (color: string | null) => void
}) {
  // 色の一覧は畳んでおく。8色を常に並べると、項目の名前より色のほうが目立つ
  const [picking, setPicking] = useState(false)
  const mark = propertyColorOf(definition.color)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: definition.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-border/70 bg-background px-3 py-2 ${
        isDragging ? 'opacity-60 shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
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
        {/* 目印の色。**カード詳細で丸が出るのと同じ位置**（名前の前）に置く。
            付けていなければ空の輪。押すと色の一覧が下に開く */}
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          disabled={busy}
          aria-expanded={picking}
          aria-label={`${definition.label}の目印の色`}
          title={mark ? `目印: ${mark.label}` : '目印の色を付ける'}
          className="size-3.5 shrink-0 rounded-full border transition-transform hover:scale-110 disabled:opacity-40"
          style={
            mark
              ? { backgroundColor: mark.hex, borderColor: 'transparent' }
              : { backgroundColor: 'transparent', borderColor: 'var(--border)' }
          }
        />
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

      {picking && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
          {PROPERTY_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                onColorChange(c.key)
                setPicking(false)
              }}
              disabled={busy}
              aria-label={c.label}
              aria-pressed={definition.color === c.key}
              title={c.label}
              className={`size-5 rounded-full transition-transform hover:scale-110 disabled:opacity-40 ${
                definition.color === c.key ? 'ring-2 ring-[var(--palace)] ring-offset-1' : ''
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          {/* 外す口を必ず置く。付けたものを戻せないと、試しに付けられない */}
          <button
            type="button"
            onClick={() => {
              onColorChange(null)
              setPicking(false)
            }}
            disabled={busy || !definition.color}
            className="ml-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            外す
          </button>
        </div>
      )}
    </div>
  )
}
