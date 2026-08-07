'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import {
  PROPERTY_VALUE_TYPES,
  PROPERTY_VALUE_TYPE_LABELS,
  getPropertyDefinitions,
  createPropertyDefinition,
  deletePropertyDefinition,
  reorderPropertyDefinitions,
  type PropertyDefinition,
  type PropertyValueType,
} from '@/lib/api/properties'
import type { ItemType } from '@/types/item'

export const PROPERTY_DEFINITIONS_PANEL_KEY = 'item-property-definitions'

/**
 * よく使う項目の下ごしらえ。
 *
 * 一から key と型を決めるのは骨が折れるうえ、key の付け方が人によってばらつくと
 * あとで書き出しや AI への指示を揃えにくくなる。分野ごとの出発点を用意しておく。
 */
const PRESETS: { group: string; items: { key: string; label: string; value_type: PropertyValueType }[] }[] = [
  {
    group: 'ことば',
    items: [
      { key: 'reading', label: '読み仮名', value_type: 'text' },
      { key: 'aliases', label: '別名・異表記', value_type: 'list' },
      { key: 'pronunciation', label: '発音記号', value_type: 'text' },
      { key: 'part_of_speech', label: '品詞', value_type: 'text' },
      { key: 'derivatives', label: '派生語', value_type: 'list' },
      { key: 'examples', label: '例', value_type: 'list' },
      { key: 'etymology', label: '語源', value_type: 'longtext' },
    ],
  },
  {
    group: 'ものごと',
    items: [
      { key: 'category', label: '分類', value_type: 'text' },
      { key: 'formula', label: '式・公式', value_type: 'text' },
      { key: 'year', label: '年', value_type: 'number' },
      { key: 'date', label: '日付', value_type: 'date' },
      { key: 'source', label: '出典', value_type: 'url' },
      { key: 'caution', label: '注意点', value_type: 'longtext' },
    ],
  },
  {
    group: '覚えかた',
    items: [
      { key: 'mnemonic', label: '語呂合わせ', value_type: 'longtext' },
      { key: 'note', label: 'メモ', value_type: 'longtext' },
    ],
  },
]

/**
 * カードが持つ項目の定義。**その種別のカード全部に効く。**
 *
 * 1枚のカードの上で編集させると、効く範囲が分からなくなる（1枚だけ変えたつもりが
 * 全部に効く）。値はカードの画面、定義はここ、と入口を分けてある。
 */
export function PropertyDefinitionsPanel({
  itemType,
  onChanged,
}: {
  itemType: ItemType | null | undefined
  /** 定義が変わったら、開いているカードを取り直してもらう */
  onChanged: () => void
}) {
  const panel = usePanelForm(PROPERTY_DEFINITIONS_PANEL_KEY, '項目の設定')
  const [definitions, setDefinitions] = useState<PropertyDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [valueType, setValueType] = useState<PropertyValueType>('text')
  const [saving, setSaving] = useState(false)

  const itemTypeId = itemType?.id

  const load = useCallback(async () => {
    if (!itemTypeId) return setDefinitions([])

    setLoading(true)
    try {
      setDefinitions(await getPropertyDefinitions(itemTypeId))
    } catch {
      setError('項目を読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [itemTypeId])

  useEffect(() => {
    if (panel.isOpen) load()
  }, [panel.isOpen, load])

  const afterChange = async () => {
    await load()
    onChanged()
  }

  const add = async (payload: { key: string; label: string; value_type: PropertyValueType }) => {
    if (!itemTypeId) return

    setSaving(true)
    setError(null)
    try {
      await createPropertyDefinition({ item_type_id: itemTypeId, ...payload })
      await afterChange()
      setAdding(false)
      setLabel('')
      setKey('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[]; error?: string } } }
      setError(
        axiosErr?.response?.data?.errors?.[0] ?? axiosErr?.response?.data?.error ?? '追加できませんでした'
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (definition: PropertyDefinition) => {
    setBusyId(definition.id)
    setError(null)
    try {
      await deletePropertyDefinition(definition.id)
      await afterChange()
    } catch {
      setError('削除できませんでした')
    } finally {
      setBusyId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= definitions.length) return

    const ids = definitions.map((d) => d.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]

    setBusyId(definitions[index].id)
    setError(null)
    try {
      await reorderPropertyDefinitions(ids)
      await afterChange()
    } catch {
      setError('並び替えられませんでした')
    } finally {
      setBusyId(null)
    }
  }

  const usedKeys = new Set(definitions.map((d) => d.key))

  return (
    <PanelSlotContent sectionKey={PROPERTY_DEFINITIONS_PANEL_KEY}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {itemType
            ? `種別「${itemType.label}」のカード全部に効きます。1枚だけ変えたいときは、カードの各項目から書き換えてください。`
            : 'まず種別を選んでください。項目は種別ごとに決めます。'}
        </p>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={14} />
            読み込み中…
          </p>
        ) : (
          <div className="space-y-2">
            {definitions.length === 0 && (
              <p className="text-sm text-muted-foreground">まだ項目がありません。</p>
            )}
            {definitions.map((definition, index) => (
              <div
                key={definition.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{definition.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {PROPERTY_VALUE_TYPE_LABELS[definition.value_type]} / {definition.key}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  {busyId === definition.id ? (
                    <Spinner size={14} />
                  ) : (
                    <>
                      <IconButton label="上へ" disabled={index === 0} onClick={() => move(index, -1)}>
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton
                        label="下へ"
                        disabled={index === definitions.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton label="削除" onClick={() => remove(definition)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {itemTypeId && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus size={14} />
            項目を追加
          </button>
        )}

        {itemTypeId && adding && (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background px-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="prop-label">名前</Label>
              <input
                id="prop-label"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value)
                  // key は機械が使う名前。空のうちだけ、打った名前から下書きする
                  if (!key) setKey(suggestKey(e.target.value))
                }}
                disabled={saving}
                autoFocus
                placeholder="例: 読み仮名"
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prop-key">識別名（英字）</Label>
              <input
                id="prop-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={saving}
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
                      disabled={saving}
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
                disabled={saving || !label.trim() || !key.trim()}
              >
                {saving ? <Spinner size={14} /> : '追加'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving}>
                キャンセル
              </Button>
            </div>
          </div>
        )}

        {itemTypeId && !adding && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-xs text-muted-foreground">よく使う項目から選ぶ</p>
            {PRESETS.map((preset) => (
              <div key={preset.group} className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">{preset.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {preset.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => add(item)}
                      disabled={saving || usedKeys.has(item.key)}
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
        )}
      </div>
    </PanelSlotContent>
  )
}

/** 名前から識別名を下書きする。英字が拾えなければ空にして、利用者に決めてもらう */
function suggestKey(label: string): string {
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(ascii) ? ascii.slice(0, 40) : ''
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="transition-colors hover:text-foreground disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  )
}
