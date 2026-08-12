'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Eye, EyeOff, GripVertical, HelpCircle, Minus, Plus, Sparkles } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { useCardDetailFit } from '@/hooks/useCardDetailColumns'
import { updateBlockView, suggestItemProperties } from '@/lib/api/items'
import { getSettings, updateSettings } from '@/lib/api/settings'
import {
  PROPERTY_PRESETS,
  PROPERTY_VALUE_TYPE_LABELS,
  createPropertyDefinition,
  type PropertyValueType,
} from '@/lib/api/properties'
import { getItem } from '@/lib/api/items'
import type { CardPropertyPreset } from '@/types/settings'
import type { Item } from '@/types/item'
import { isSubmitEnter } from '@/lib/enter-key'

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
  columns,
  onColumnsChange,
  onUpdated,
}: {
  item: Item
  /** いまの列数（この端末で覚える） */
  columns: number
  onColumnsChange: (next: number) => void
  /** ＋ の段（並べ替え適用後） */
  blocks: CardBlock[]
  /** − の段（このカードでは持たない項目） */
  omitted: CardBlock[]
  onUpdated: (item: Item) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  // AI に選ばせる前の並び。1回だけ戻せるようにする
  const [beforeSuggest, setBeforeSuggest] = useState<{ order: string[]; omitted: string[] } | null>(null)
  const hidden = new Set(item.block_view?.hidden ?? [])
  const omittedKeys = new Set(item.block_view?.omitted ?? [])
  // 4px 動かすまでは並べ替えを始めない。表示の入り切りを押すだけのつもりが
  // 指が滑って並びまで変わる、を防ぐ
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const { fit, change: changeFit } = useCardDetailFit()

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
  const allKeys = [...order, ...omitted.map((b) => b.key)]
  // このカードに出ている項目の識別名（prop:xxx から xxx を取り出す）。
  // 既にあるものを「足せる」として出さないため
  const allAdoptedKeys = new Set(
    allKeys.filter((key) => key.startsWith('prop:')).map((key) => key.slice('prop:'.length))
  )

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

  // ひな型を当てる。keys にあるものを ＋（その順）、それ以外を − にする。
  // ひな型に無いキー（あとから増えた項目）は − に落ちる。勝手に出すより、
  // 出したいときに戻してもらうほうが、当てた結果が読める
  const applyPreset = (preset: CardPropertyPreset) => {
    const wanted = preset.keys.filter((key) => allKeys.includes(key))
    save([...hidden].filter((k) => wanted.includes(k)), wanted, allKeys.filter((k) => !wanted.includes(k)))
  }

  // AI に選ばせる。渡すのは「いま定義されている項目」だけで、
  // 新しい項目は作らせない（種別の定義が AI の思いつきで増えるのを避ける）
  const suggest = async () => {
    setSuggesting(true)
    setSuggestError(null)
    try {
      const keys = await suggestItemProperties(item.id, allKeys)
      const wanted = keys.filter((key) => allKeys.includes(key))
      if (wanted.length === 0) {
        setSuggestError('選べませんでした')
        return
      }
      setBeforeSuggest({ order, omitted: [...omittedKeys] })
      await save([...hidden].filter((k) => wanted.includes(k)), wanted, allKeys.filter((k) => !wanted.includes(k)))
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setSuggestError(detail ?? '選べませんでした。時間を置いてお試しください。')
    } finally {
      setSuggesting(false)
    }
  }

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
        {/* 説明は置かない。＋ と − の段に見出しが付いていて、押せば結果が見える。
            開くたびに同じ文を読ませるほうが、面積も注意も食う */}

        {/* 列数はこの端末で覚える。項目の少ないカードは1列、多いカードは2列、と
            カードによって変えたくなる。既定は環境設定（アカウント）に持つ */}
        {/* 見返すときは、見出し語と絵だけを大きく見たい。
            項目を作り込む見方とは目的が違うので、切り替えで持つ（端末ごとに覚える） */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fit}
            onChange={(e) => changeFit(e.target.checked)}
          />
          画面に収める（見出し語とイメージだけ）
        </label>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">列の数</p>
          <div className="flex gap-1.5">
            {[ 1, 2, 3 ].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onColumnsChange(count)}
                className={`rounded-lg border px-3 py-1 text-sm transition-colors ${
                  columns === count
                    ? 'border-[var(--palace)] text-[var(--palace)]'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <PresetBar
          current={order}
          onApply={applyPreset}
          disabled={busy}
          onSuggest={suggest}
          suggesting={suggesting}
        />

        {/* 当てたあとに戻せるようにする。AI の結果は当たり外れがあるので、
            見て違えば1回で戻せないと、押すのが怖い操作になる */}
        {beforeSuggest && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>AI が選んだ並びに変えました</span>
            <button
              type="button"
              onClick={() => {
                const previous = beforeSuggest
                setBeforeSuggest(null)
                save([...hidden], previous.order, previous.omitted)
              }}
              disabled={busy}
              className="hover:underline disabled:opacity-50"
            >
              元に戻す
            </button>
          </div>
        )}
        {suggestError && <p className="text-xs text-destructive">{suggestError}</p>}

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

        {/* まだ作っていない項目も、ここから足せるようにする。
            「持たない」に出るのは既に定義したものだけなので、
            Wikipedia のような新しい項目は、環境設定まで行かないと存在に気づけなかった */}
        <AddableProperties item={item} adoptedKeys={allAdoptedKeys} onUpdated={onUpdated} />

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

/**
 * ひな型。いまの並びを名前を付けて覚え、他のカードで呼び出す。
 *
 * 100枚作れば100回同じ操作をすることになるので、1枚で決めた形を使い回せるようにする。
 * 覚えるのは**キーの並びだけ**で、中身（値）は覚えない。値まで持つと、
 * 当てた瞬間に別のカードの内容が入ってくることになる。
 */
function PresetBar({
  current,
  onApply,
  disabled,
  onSuggest,
  suggesting,
}: {
  current: string[]
  onApply: (preset: CardPropertyPreset) => void
  disabled?: boolean
  /** AI に選ばせる。ひな型と同じ「並びをまとめて当てる」操作なので、ここに置く */
  onSuggest: () => void
  suggesting: boolean
}) {
  const [presets, setPresets] = useState<CardPropertyPreset[] | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  // 触っているひな型（更新・削除の対象）。開いたまま次を押せると、
  // どれに対する操作なのか分からなくなるので1つだけ持つ
  const [editing, setEditing] = useState<string | null>(null)
  // 消したものを1つだけ覚えておく。押し間違いは必ず起きるし、
  // 並びを作り直すのは手間なので、その場で戻せるようにする
  const [undo, setUndo] = useState<CardPropertyPreset | null>(null)

  useEffect(() => {
    getSettings()
      .then((s) => setPresets(s.card_property_presets ?? []))
      .catch(() => setPresets([]))
  }, [])

  const remember = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      // 同じ名前は上書きする。増やし続けると選ぶほうが大変になる
      const next = [...(presets ?? []).filter((p) => p.name !== trimmed), { name: trimmed, keys: current }]
      const saved = await updateSettings({ card_property_presets: next })
      setPresets(saved.card_property_presets ?? [])
      setName('')
      setNaming(false)
    } catch {
      // 失敗しても画面は壊さない。もう一度押せばよい
    } finally {
      setSaving(false)
    }
  }

  // 名前は変えず、いまの並びで中身だけ入れ替える。
  // 「覚え直す」ために消して作り直すのは、名前を打ち直す手間が要る
  const update = async (target: CardPropertyPreset) => {
    setSaving(true)
    try {
      const next = (presets ?? []).map((p) => (p.name === target.name ? { ...p, keys: current } : p))
      const saved = await updateSettings({ card_property_presets: next })
      setPresets(saved.card_property_presets ?? [])
      setEditing(null)
    } catch {
      // 失敗しても画面は壊さない
    } finally {
      setSaving(false)
    }
  }

  const remove = async (target: CardPropertyPreset) => {
    setSaving(true)
    try {
      const next = (presets ?? []).filter((p) => p.name !== target.name)
      const saved = await updateSettings({ card_property_presets: next })
      setPresets(saved.card_property_presets ?? [])
      setUndo(target)
      setEditing(null)
    } catch {
      // 失敗しても画面は壊さない
    } finally {
      setSaving(false)
    }
  }

  const restore = async () => {
    if (!undo) return
    setSaving(true)
    try {
      const saved = await updateSettings({ card_property_presets: [ ...(presets ?? []), undo ] })
      setPresets(saved.card_property_presets ?? [])
      setUndo(null)
    } catch {
      // 失敗しても画面は壊さない
    } finally {
      setSaving(false)
    }
  }

  if (presets === null) return null

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">ひな型</span>
        {presets.length === 0 ? (
          <span className="text-xs text-muted-foreground">まだありません</span>
        ) : (
          presets.map((preset) => (
            <span key={preset.name} className="flex items-center">
              <button
                type="button"
                onClick={() => onApply(preset)}
                disabled={disabled}
                className="rounded-l-full border border-r-0 border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {preset.name}
              </button>
              {/* 直す口は押した先に置く。並べて出すと、当てるつもりが消すことになる */}
              <button
                type="button"
                onClick={() => setEditing(editing === preset.name ? null : preset.name)}
                disabled={disabled}
                aria-label={`${preset.name} を直す`}
                className="rounded-r-full border border-border px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <ChevronDown size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* 直す口。当てる（上の札）とは分けて、押した1つだけに出す */}
      {editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
          <span className="text-xs font-medium">{editing}</span>
          <button
            type="button"
            onClick={() => update(presets.find((p) => p.name === editing)!)}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            いまの並びで更新
          </button>
          <button
            type="button"
            onClick={() => remove(presets.find((p) => p.name === editing)!)}
            disabled={saving}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            削除
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="ml-auto text-xs text-muted-foreground hover:underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* 消したものは1つだけ戻せる。押し間違いは必ず起きるし、並びを作り直すのは手間 */}
      {undo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>「{undo.name}」を削除しました</span>
          <button type="button" onClick={restore} disabled={saving} className="hover:underline disabled:opacity-50">
            元に戻す
          </button>
        </div>
      )}

      {/* AI に選ばせるのも「並びをまとめて当てる」操作。ひな型と同じ場所に置く */}
      <button
        type="button"
        onClick={onSuggest}
        disabled={disabled || suggesting}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        {suggesting ? <Spinner size={11} /> : <Sparkles size={11} />}
        このカードに合う項目をAIに選ばせる
      </button>

      {naming ? (
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (isSubmitEnter(e)) {
                e.preventDefault()
                remember()
              }
              if (e.key === 'Escape') setNaming(false)
            }}
            placeholder="ひな型の名前"
            autoFocus
            className="h-7 text-xs"
          />
          <Button size="sm" onClick={remember} disabled={saving || !name.trim()} className="h-7 text-xs">
            {saving ? <Spinner size={12} /> : '覚える'}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          いまの並びをひな型として覚える
        </button>
      )}
    </div>
  )
}

/**
 * まだ作っていない項目を、ここから足す。
 *
 * 「− 持たない項目」に出るのは**既に定義した**ものだけ。
 * だから新しく用意した項目（Wikipedia など）は、環境設定の「カードの項目」まで
 * 行かないと存在に気づけなかった。実際そこで詰まった。
 *
 * ここで押すと、その種別に項目を作ってこのカードに出す。
 * 種別ぜんぶに効く操作なので、そうと分かるように書いておく。
 */
function AddableProperties({
  item,
  adoptedKeys,
  onUpdated,
}: {
  item: Item
  adoptedKeys: Set<string>
  onUpdated: (item: Item) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const itemTypeId = item.item_type?.id

  if (!itemTypeId) return null

  const candidates = PROPERTY_PRESETS.flatMap((group) =>
    group.items.filter((preset) => !adoptedKeys.has(preset.key)).map((preset) => ({ ...group, ...preset }))
  )

  if (candidates.length === 0) return null

  const add = async (preset: {
    key: string
    label: string
    value_type: PropertyValueType
    description: string
  }) => {
    setBusy(preset.key)
    setError(null)
    try {
      // 説明も一緒に持たせる。作ったあと「これは何を入れる項目だったか」を
      // 思い出せるようにしておく（一覧では ? に出る）
      await createPropertyDefinition({
        item_type_id: itemTypeId,
        key: preset.key,
        label: preset.label,
        value_type: preset.value_type,
        description: preset.description,
      })
      onUpdated(await getItem(item.id))
    } catch {
      setError('足せませんでした。同じ識別名の項目が既にあるかもしれません。')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs font-medium">＋ まだ無い項目を作る</p>
      <p className="text-xs text-muted-foreground">
        押すと「{item.item_type?.label}」の項目として作られます（この種別のカード全部に出ます）。
      </p>
      {/* 1行に1つ並べる。丸い札を折り返すと、数が増えたときに見出しの列に見えて
          「押せるもの」に見えなくなる。上の採用済みの行と同じ形にして、
          同じ性質のものだと分かるようにする */}
      <ul className="space-y-1">
        {candidates.map((preset) => (
          <li
            key={preset.key}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-xs">{preset.label}</span>
            {/* 名前だけでは何を入れる項目か分からないものがある（「分類」「例」など）。
                説明は常時出さずに畳む。並べたときに縦へ伸びすぎるため */}
            <Tooltip label={preset.description}>
              <span className="shrink-0 text-muted-foreground" aria-label={`${preset.label}の説明`}>
                <HelpCircle size={13} />
              </span>
            </Tooltip>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {PROPERTY_VALUE_TYPE_LABELS[preset.value_type]}
            </span>
            <button
              type="button"
              onClick={() => add(preset)}
              disabled={busy !== null}
              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              {busy === preset.key ? <Spinner size={11} /> : <Plus size={11} />}
              作る
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
