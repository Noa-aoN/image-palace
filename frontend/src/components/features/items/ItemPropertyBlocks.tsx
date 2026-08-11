'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, RefreshCw, Settings2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PropertyBlock, BlockAction, BlockEmpty, BlockError } from '@/components/features/items/PropertyBlock'
import { setItemProperty, fillItemProperties, type ItemPropertyEntry } from '@/lib/api/properties'
import { getItem } from '@/lib/api/items'
import type { Item } from '@/types/item'
import { WikipediaProperty } from './WikipediaProperty'
import type { WikipediaValue } from '@/lib/api/properties'

/**
 * 項目の道具立て（未記入の数・まとめてAIで埋める・項目の設定への入口）。
 *
 * 1件ぶんの器は PropertyEntryBlock。並べるのは ItemProperties 側で、
 * **作り付けの項目と同じ一覧**に混ぜる。混ぜないと、並べ替えも出し入れも
 * 作り付けのものにしか効かない（実際そうなっていた）。
 *
 * 読み仮名・別名・発音記号・派生語…と、覚えたいものは分野で変わる。
 * 欄を足し続ける代わりに、項目そのものを定義できるようにしてある
 * （定義は種別ごと。単語には読み仮名が要るが、人物には要らない）。
 *
 * ここで触るのは**このカードの値だけ**。どの項目を持つかは種別ぜんぶに効くので、
 * 入口を分けて右パネルへ置く。1枚のカードの上で全体の設定をさせない。
 */
export function PropertyToolsBlock({
  item,
  onUpdated,
  onOpenSettings,
}: {
  item: Item
  onUpdated: (item: Item) => void
  /** 項目の定義（種別ぜんぶに効く）を開く */
  onOpenSettings: () => void
}) {
  const entries = item.properties ?? []
  const [filling, setFilling] = useState(false)
  const [fillNote, setFillNote] = useState<string | null>(null)

  // 項目ごとに呼ばず、1回でまとめて埋める。
  // 既定は空いている項目だけ。書いたものを消されると困る場面のほうが多いので、
  // 入れ直しは押す前に選ばせる（押した先で分岐させない）
  const fillAll = async (overwrite: boolean) => {
    setFilling(true)
    setFillNote(null)
    try {
      const result = await fillItemProperties(item.id, { overwrite })
      onUpdated(await getItem(item.id))
      setFillNote(
        result.filled_keys.length === 0
          ? '埋められる項目がありませんでした（確かでないものは書きません）'
          : `${result.filled_keys.length}件を${overwrite ? '入れ直しました' : '埋めました'}${
              result.skipped_keys.length > 0 ? `（${result.skipped_keys.length}件は見送り）` : ''
            }`
      )
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setFillNote(axiosErr?.response?.data?.error ?? '埋められませんでした。時間を置いてお試しください。')
    } finally {
      setFilling(false)
    }
  }

  // 定義が1つも無いときは、入口だけ出す。空のブロックを並べても意味がない
  if (entries.length === 0) {
    return (
      <PropertyBlock
        title="項目"
        actions={<BlockAction icon={<Settings2 size={14} />} label="項目を設定" onClick={onOpenSettings} />}
      >
        <BlockEmpty>
          {item.item_type
            ? `「${item.item_type.label}」に項目はまだありません。読み仮名・別名・発音記号など、覚えるのに要るものを足せます。`
            : '種別を選ぶと、その種別の項目を足せます。'}
        </BlockEmpty>
      </PropertyBlock>
    )
  }

  const emptyCount = entries.filter((e) =>
    e.value_type === 'list' ? ((e.value as string[] | null) ?? []).length === 0 : e.value == null || e.value === ''
  ).length
  const filledCount = entries.length - emptyCount

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {fillNote ?? `未記入の項目が ${emptyCount} 件あります`}
        </p>
        <div className="flex items-center gap-3">
          {emptyCount > 0 && (
            <BlockAction
              icon={<Sparkles size={14} />}
              label="空欄をAIで埋める"
              onClick={() => fillAll(false)}
              busy={filling}
              title="空いている項目だけを、1回の問い合わせでまとめて埋めます（書いたものは変えません）"
            />
          )}
          {filledCount > 0 && (
            <BlockAction
              icon={<RefreshCw size={14} />}
              label="ぜんぶ入れ直す"
              onClick={() => fillAll(true)}
              busy={filling}
              title="書いたものも含めて、すべての項目をAIで入れ直します"
            />
          )}
        </div>
      </div>
    </>
  )
}

export function PropertyEntryBlock({
  item,
  entry,
  onUpdated,
  onOpenSettings,
}: {
  item: Item
  entry: ItemPropertyEntry
  onUpdated: (item: Item) => void
  onOpenSettings?: () => void
}) {
  const isList = entry.value_type === 'list'
  // Wikipedia は手で書く項目ではない。引いてきた結果をそのまま持つ
  const isWikipedia = entry.value_type === 'wikipedia'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listValue = isList ? ((entry.value as string[] | null) ?? []) : []
  const scalarValue = isList ? '' : entry.value == null ? '' : String(entry.value)
  const filled = isList ? listValue.length > 0 : scalarValue !== ''

  const startEdit = () => {
    // 複数の値は1行1件で書く。区切り文字を覚えさせるより、見たまま並べたほうが早い
    setDraft(isList ? listValue.join('\n') : scalarValue)
    setEditing(true)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const value = isList ? draft.split('\n').map((line) => line.trim()).filter(Boolean) : draft.trim()
      await setItemProperty(item.id, entry.property_definition_id, value)
      // 1件ぶんを自前で当てず、カードを取り直す。項目は種別で増減するので、
      // 差分を当てると一覧と食い違いやすい
      onUpdated(await getItem(item.id))
      setEditing(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? '保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  // この項目だけを AI に書かせる。呼び出しは1回なので、
  // 「項目ごとに叩く」形（費用が項目数に比例する）にはならない
  const write = async () => {
    setWriting(true)
    setError(null)
    try {
      const result = await fillItemProperties(item.id, { keys: [entry.key] })
      onUpdated(await getItem(item.id))
      if (!result.filled_keys.includes(entry.key)) {
        // 確かでないものは返さない作りなので、書けないこと自体は異常ではない。
        // 黙って何も起きないと壊れて見えるので、そう伝える
        setError('確かなことが分からず、書けませんでした。')
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(detail ?? '書けませんでした。時間を置いてお試しください。')
    } finally {
      setWriting(false)
    }
  }

  return (
    <PropertyBlock
      title={entry.label}
      busy={writing}
      actions={
        <>
          {/* Wikipedia は引いてきた結果を持つ項目。
              手で書く・AI に書かせる口は出さない（出どころが混ざる） */}
          {!editing && !isWikipedia && (
            <BlockAction
              icon={<Sparkles size={14} />}
              label={filled ? 'AIで書き直す' : 'AIで書く'}
              onClick={write}
              busy={writing}
              hideLabel={filled}
            />
          )}
          {!editing && !isWikipedia && (
            <BlockAction
              icon={filled ? <Pencil size={14} /> : <Plus size={14} />}
              label={filled ? '編集' : '書く'}
              onClick={startEdit}
              hideLabel={filled}
            />
          )}
          {onOpenSettings && !editing && (
            <BlockAction
              icon={<Settings2 size={14} />}
              label="項目を設定"
              onClick={onOpenSettings}
              hideLabel
              title="この種別のカードが持つ項目を編集します"
            />
          )}
        </>
      }
    >
      {isWikipedia ? (
        <WikipediaProperty
          value={parseWikipedia(scalarValue)}
          term={item.title}
          editable
          onSaved={async (next) => {
            await setItemProperty(item.id, entry.property_definition_id, JSON.stringify(next))
            onUpdated(await getItem(item.id))
          }}
        />
      ) : editing ? (
        <div className="space-y-2">
          {isList || entry.value_type === 'longtext' ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
              rows={isList ? 4 : 3}
              placeholder={isList ? '1行に1つ' : entry.description ?? ''}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
              type={entry.value_type === 'date' ? 'date' : 'text'}
              inputMode={entry.value_type === 'number' ? 'decimal' : undefined}
              placeholder={entry.description ?? ''}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="flex items-center gap-1.5">
              {saving ? <Spinner size={14} /> : <Check size={14} />}
              保存
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex items-center gap-1.5"
            >
              <X size={14} />
              キャンセル
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isList ? '1行に1つ書きます。空にすると未設定に戻ります。' : '空にすると未設定に戻ります。'}
          </p>
          <BlockError message={error} />
        </div>
      ) : (
        <>
          <PropertyValue entry={entry} listValue={listValue} scalarValue={scalarValue} filled={filled} />
          <BlockError message={error} />
        </>
      )}
    </PropertyBlock>
  )
}

function PropertyValue({
  entry,
  listValue,
  scalarValue,
  filled,
}: {
  entry: ItemPropertyEntry
  listValue: string[]
  scalarValue: string
  filled: boolean
}) {
  if (!filled) return <BlockEmpty>未設定</BlockEmpty>

  if (entry.value_type === 'list') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {listValue.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="rounded-full px-2.5 py-0.5 text-xs"
            style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: '#7a6432' }}
          >
            {value}
          </span>
        ))}
      </div>
    )
  }

  if (entry.value_type === 'wikipedia') {
    // 器（PropertyValue）は値を出すだけの場所なので、引き直しの操作は持たせない。
    // 押せるものは編集の側（PropertyEntryBlock）に置く
    return <WikipediaProperty value={parseWikipedia(scalarValue)} term="" onSaved={() => {}} editable={false} />
  }

  if (entry.value_type === 'url') {
    return (
      <a
        href={scalarValue}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm text-foreground underline-offset-2 hover:underline"
      >
        {scalarValue}
      </a>
    )
  }

  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{scalarValue}</p>
}

/**
 * 保存してある Wikipedia の値を読む。
 *
 * 壊れた値が入っていても画面は出す（未設定として扱う）。
 * 外から来た JSON なので、形が変わっていても落ちないようにしておく。
 */
function parseWikipedia(raw: string): WikipediaValue | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WikipediaValue
    return parsed && typeof parsed.title === 'string' ? parsed : null
  } catch {
    return null
  }
}
