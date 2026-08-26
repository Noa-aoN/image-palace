'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Check, Pencil, Plus, RefreshCw, Settings2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PropertyBlock, BlockAction, BlockEmpty, BlockError } from '@/components/features/items/PropertyBlock'
import {
  setItemProperty,
  fillItemProperties,
  createPropertyDefinition,
  commonPropertyPresets,
  PROPERTY_PRESETS,
  type ItemPropertyEntry,
} from '@/lib/api/properties'
import { isFilled } from '@/lib/items/property-value'
import { ReadingProperty } from '@/components/features/items/ReadingProperty'
import type { ReadingValue } from '@/lib/api/properties'
import { getItem } from '@/lib/api/items'
import type { Item } from '@/types/item'
import { WikipediaProperty } from './WikipediaProperty'
import type { WikipediaValue, FreeTextValue, FreeImageValue } from '@/lib/api/properties'
import { generateFreeImage } from '@/lib/api/properties'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'

/** 出来上がりを待つ間隔。生成は数十秒かかるので、これ以上細かくしても意味がない */
const POLL_INTERVAL_MS = 3000
/** 見えていないタブでの間隔。止めずに緩める（戻ったときに待たせない） */
const POLL_HIDDEN_MS = 15000
/** 諦めるまでの回数。3秒 × 100 = 5分 */
const POLL_MAX_TRIES = 100

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
/**
 * 項目の道具の並び順キー。
 *
 * これはカードの**中身ではなく道具**（項目を足す・AI で埋める入口）。
 * ひな型は「どの中身を出すか」を決めるものなので、ここは畳まない。
 * 畳むと、ひな型を当てた瞬間に項目を足す方法が画面から消える。
 */
export const PROPERTY_TOOLS_KEY = 'property_tools'

/**
 * 項目がまだ1つも無いときの案内。
 *
 * ここが実質の入口になる。項目は利用者ごとに一から作る作りなので、
 * **何もしなければ一生 0 件のまま**。実際、本番では所有者以外の全員が 0 件だった。
 *
 * 「項目を設定」へ送るだけにしていたときは、誰も辿り着かなかった。
 * だから、ここで作れるようにする。設定画面は細かく決めたい人の場所として残す。
 */
function PropertyEmptyState({
  item,
  onUpdated,
  onOpenSettings,
  onCreated,
}: {
  item: Item
  onUpdated: (item: Item) => void
  onOpenSettings: () => void
  onCreated?: (key: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const itemTypeId = item.item_type?.id
  const typeLabel = item.item_type?.label

  if (!itemTypeId || !typeLabel) {
    return (
      <PropertyBlock title="情報欄">
        <BlockEmpty>種別を選ぶと、その種別の項目を足せます。</BlockEmpty>
      </PropertyBlock>
    )
  }

  const add = async (preset: (typeof PROPERTY_PRESETS)[number]['items'][number]) => {
    setBusy(preset.key)
    setError(null)
    try {
      await createPropertyDefinition({
        item_type_id: itemTypeId,
        key: preset.key,
        label: preset.label,
        value_type: preset.value_type,
        description: preset.description,
      })
      // 先に知らせてから中身を差し替える。順が逆だと、札が出たあとに
      // 「作った直後」の合図が届き、調べ始めが1拍遅れる
      onCreated?.(preset.key)
      onUpdated(await getItem(item.id))
    } catch {
      setError('足せませんでした。同じ識別名の項目が既にあるかもしれません。')
    } finally {
      setBusy(null)
    }
  }

  const [wikipedia, ...others] = commonPropertyPresets()

  return (
    <PropertyBlock
      title="情報欄を追加できます"
      actions={<BlockAction icon={<Settings2 size={14} />} label="細かく決める" onClick={onOpenSettings} />}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Wikipedia の解説、読み方（言語ごとにも持てます）、語源、発音、例文などを、このカードに持たせられます。
          {/* 押す前に知らせる。218枚に一度に反映されるので、知らないと驚きになる */}
          <span className="text-foreground">
            {' '}足した項目は「{typeLabel}」のカード全部に出ます。
          </span>
        </p>

        {/* Wikipedia だけ主ボタンにする。他は枠を作るだけだが、
            これは押せば**そのまま調べて中身まで入る**。
            同じ見た目で並べると、その差が伝わらない */}
        {wikipedia && (
          <Button
            size="sm"
            onClick={() => add(wikipedia)}
            disabled={busy !== null}
            className="flex items-center gap-1.5"
          >
            {busy === wikipedia.key ? <Spinner size={13} /> : <BookOpen size={13} />}
            Wikipedia で調べる
          </Button>
        )}

        <div className="flex flex-wrap gap-1.5">
          {others.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => add(preset)}
              disabled={busy !== null}
              title={preset.description}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              {busy === preset.key ? <Spinner size={11} /> : <Plus size={11} />}
              {preset.label}
            </button>
          ))}
          {/* 残り12件はここから。最初から19件出すと、どれから始めるかが仕事になる */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            ほかの項目を見る
          </button>
        </div>

        <BlockError message={error} />
      </div>
    </PropertyBlock>
  )
}

export function PropertyToolsBlock({
  item,
  onUpdated,
  onOpenSettings,
  onCreated,
}: {
  item: Item
  onUpdated: (item: Item) => void
  /** 項目の定義（種別ぜんぶに効く）を開く */
  onOpenSettings: () => void
  /** いま作った項目の識別名。作った直後だけ効かせたい振る舞いに使う */
  onCreated?: (key: string) => void
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
      <PropertyEmptyState
        item={item}
        onUpdated={onUpdated}
        onOpenSettings={onOpenSettings}
        onCreated={onCreated}
      />
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
  autoLookup = false,
}: {
  item: Item
  entry: ItemPropertyEntry
  onUpdated: (item: Item) => void
  onOpenSettings?: () => void
  /** 作った直後だけ true。Wikipedia を押さずとも調べ始める */
  autoLookup?: boolean
}) {
  const isList = entry.value_type === 'list'
  // チェックは「入 / 切」を持つ。**触っていない状態と「切」は別**なので、
  // 空にできる道（未設定へ戻す）も残す
  const isCheck = entry.value_type === 'boolean'
  // 選ぶ項目。**選択肢は定義側が持つ**ので、ここでは並べて押させるだけ
  const isSelect = entry.value_type === 'select'
  // 言語ごとの読み方。**1つの項目の中に並びで持つ**
  const isReading = entry.value_type === 'reading'
  const choices = entry.options ?? []
  // 自由欄。見出しも中身もこのカードで決める
  const isFree = entry.value_type === 'free_text'
  // 自由イメージ。**カードの見出し語には縛られない絵**
  const isFreeImage = entry.value_type === 'free_image'
  const freeImage = (isFreeImage ? (entry.value as FreeImageValue | null) : null) ?? {}
  const generating = freeImage.status === 'pending' || freeImage.status === 'processing'
  const freeValue = (isFree ? (entry.value as FreeTextValue | null) : null) ?? { heading: '', body: '' }
  // Wikipedia は手で書く項目ではない。引いてきた結果をそのまま持つ
  const isWikipedia = entry.value_type === 'wikipedia'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listValue = isList ? ((entry.value as string[] | null) ?? []) : []
  const scalarValue = isList ? '' : entry.value == null ? '' : String(entry.value)
  const filled = isFreeImage
    ? Boolean(freeImage.heading || freeImage.prompt)
    : isCheck
    ? entry.value != null
    : isFree
      ? Boolean(freeValue.heading || freeValue.body)
      : isList
        ? listValue.length > 0
        : scalarValue !== ''

  const startEdit = () => {
    // 複数の値は1行1件で書く。区切り文字を覚えさせるより、見たまま並べたほうが早い
    setDraft(isList ? listValue.join('\n') : scalarValue)
    setFreeDraft(freeValue)
    setEditing(true)
    setError(null)
  }

  // 自由欄の下書き。見出しと中身を別に持つ
  const [freeDraft, setFreeDraft] = useState<FreeTextValue>({ heading: '', body: '' })

  const saveFree = async () => {
    setSaving(true)
    setError(null)
    try {
      await setItemProperty(item.id, entry.property_definition_id, JSON.stringify(freeDraft))
      onUpdated(await getItem(item.id))
      setEditing(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? '保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  // チェックはその場で入れる（編集に入らない）
  const saveCheck = async (value: string) => {
    setSaving(true)
    setError(null)
    try {
      await setItemProperty(item.id, entry.property_definition_id, value)
      onUpdated(await getItem(item.id))
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
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
      category={entry.category}
      // 自分で付けた目印。見出しの前に小さな丸で出る
      color={entry.color}
      // **書いていないものは地を落とす。** 上から読んで、どこまで書いたかが分かる
      empty={!isFilled(entry)}
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
      {isFreeImage ? (
        <FreeImageField
          item={item}
          entry={entry}
          value={freeImage}
          generating={generating}
          onUpdated={onUpdated}
        />
      ) : isReading ? (
        <ReadingProperty
          value={(entry.value as ReadingValue | null) ?? []}
          onSave={async (next) => {
            await setItemProperty(item.id, entry.property_definition_id, JSON.stringify(next))
            onUpdated(await getItem(item.id))
          }}
        />
      ) : isSelect && !editing ? (
        // チェックと同じく一手で決まる。**編集に入って保存する形にすると、
        // 選ぶだけのことに3回押させることになる**
        <div className="flex flex-wrap items-center gap-2">
          {choices.length === 0 ? (
            <BlockEmpty>選択肢がありません（項目の設定で足してください）</BlockEmpty>
          ) : (
            choices.map((choice) => {
              const active = filled && entry.value === choice
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => saveCheck(choice)}
                  disabled={saving}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-0.5 text-sm transition-colors disabled:opacity-50 ${
                    active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                  style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                >
                  {choice}
                </button>
              )
            })
          )}
          {filled && (
            <button
              type="button"
              onClick={() => saveCheck('')}
              disabled={saving}
              className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              未設定に戻す
            </button>
          )}
          {saving && <Spinner size={14} className="text-muted-foreground" />}
          <BlockError message={error} />
        </div>
      ) : isCheck && !editing ? (
        // チェックは一手で決まる。**編集に入って保存する形にすると、
        // 印を付けるだけのことに3回押させることになる**
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: 'true', label: '入' },
            { value: 'false', label: '切' },
          ].map((choice) => {
            const active = filled && String(entry.value) === choice.value
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => saveCheck(choice.value)}
                disabled={saving}
                aria-pressed={active}
                className={`rounded-full border px-3 py-0.5 text-sm transition-colors disabled:opacity-50 ${
                  active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={active ? { backgroundColor: 'var(--palace)' } : undefined}
              >
                {choice.label}
              </button>
            )
          })}
          {filled && (
            <button
              type="button"
              onClick={() => saveCheck('')}
              disabled={saving}
              className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              未設定に戻す
            </button>
          )}
          {saving && <Spinner size={14} className="text-muted-foreground" />}
          <BlockError message={error} />
        </div>
      ) : isWikipedia ? (
        <WikipediaProperty
          value={parseWikipedia(scalarValue)}
          term={item.title}
          editable
          autoLookup={autoLookup}
          onSaved={async (next) => {
            await setItemProperty(item.id, entry.property_definition_id, JSON.stringify(next))
            onUpdated(await getItem(item.id))
          }}
        />
      ) : editing && isFree ? (
        <div className="space-y-2">
          {/* 見出しもこのカードで決める。**定義側で決めないから、同じ欄を何枚でも置ける** */}
          <input
            value={freeDraft.heading}
            onChange={(e) => setFreeDraft({ ...freeDraft, heading: e.target.value })}
            disabled={saving}
            autoFocus
            placeholder="見出し（例：覚えるコツ）"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <textarea
            value={freeDraft.body}
            onChange={(e) => setFreeDraft({ ...freeDraft, body: e.target.value })}
            disabled={saving}
            rows={3}
            placeholder="中身"
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveFree} disabled={saving} className="flex items-center gap-1.5">
              {saving ? <Spinner size={14} /> : <Check size={14} />}
              保存
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              <X size={14} />
              キャンセル
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            見出しだけ、中身だけでも残せます。どちらも空にすると未設定に戻ります。
          </p>
          <BlockError message={error} />
        </div>
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

  if (entry.value_type === 'free_text') {
    const value = entry.value as FreeTextValue
    return (
      <div className="space-y-1">
        {value.heading && <p className="text-sm font-medium">{value.heading}</p>}
        {value.body && <p className="whitespace-pre-wrap text-sm">{value.body}</p>}
      </div>
    )
  }

  if (entry.value_type === 'boolean') {
    const on = entry.value === true || entry.value === 'true'
    return (
      <p className="flex items-center gap-1.5 text-sm">
        {on ? <Check size={16} style={{ color: 'var(--palace)' }} /> : <X size={16} className="text-muted-foreground" />}
        <span className={on ? '' : 'text-muted-foreground'}>{on ? '入' : '切'}</span>
      </p>
    )
  }

  if (entry.value_type === 'list') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {listValue.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="rounded-full px-2.5 py-0.5 text-xs"
            style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--tag-ink)' }}
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
    return parsed && typeof parsed.wikipedia_title === 'string' ? parsed : null
  } catch {
    return null
  }
}

/**
 * 自由イメージ。**小見出しと、描いてほしいことを書いて作る。**
 *
 * カードの見出し語からは作らない。そのカードの中の一場面・対比・図解など、
 * 見出し語1つでは表せないものを持つための欄。
 *
 * 1枚作るので、カードの絵と同じだけクレジットを使う。**押す前に分かるように書いておく。**
 */
function FreeImageField({
  item,
  entry,
  value,
  generating,
  onUpdated,
}: {
  item: Item
  entry: ItemPropertyEntry
  value: FreeImageValue
  generating: boolean
  onUpdated: (item: Item) => void
}) {
  const [heading, setHeading] = useState(value.heading ?? '')
  const [prompt, setPrompt] = useState(value.prompt ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
    作っている間は、出来上がりを待って取り直す。

    **setInterval では止まらない。** 前の呼び出しが返る前に次が飛ぶし、
    途中で落ちても回り続ける。実際ここは
      ・裏のタブでも3秒ごとに叩く
      ・`await` が落ちても捕まえない（次の tick がまた来る）
      ・止まる条件が `generating` だけ
    で、親が旗を落とし損ねると**永久に回る**形だった。

    1回ずつ次を約束する形にして、見えていない間は休み、
    数えた回数で必ず終わる（3秒 × 100 = 5分）ようにする。
  */
  useEffect(() => {
    if (!generating) return

    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0

    const tick = async () => {
      if (!alive) return
      // 見えていないタブでは取りに行かない（戻ってきたら次の tick で拾う）
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(tick, POLL_HIDDEN_MS)
        return
      }
      try {
        onUpdated(await getItem(item.id))
      } catch {
        // 取れなくても回り続ける（生成そのものはサーバー側で進んでいる）
      }
      if (!alive) return
      tries += 1
      // **必ず終わる。** 5分待って出来ていないなら、開き直したほうが早い
      if (tries < POLL_MAX_TRIES) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [generating, item.id, onUpdated])

  const generate = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await generateFreeImage(item.id, entry.property_definition_id, {
        heading: heading.trim(),
        prompt: prompt.trim(),
      })
      onUpdated(await getItem(item.id))
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error ?? '作れませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {value.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.url} alt={value.heading ?? ''} loading="lazy" className="w-full rounded-lg" />
      )}

      {generating && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 作っています
        </p>
      )}

      {value.status === 'failed' && (
        <p className="text-sm text-destructive">{value.error ?? '作れませんでした'}</p>
      )}

      <input
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        disabled={busy || generating}
        placeholder="小見出し（例：葉のなか）"
        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={busy || generating}
        rows={2}
        placeholder="何を描くか（例：葉緑体が光を受けている場面）"
        className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={generate} disabled={busy || generating || !prompt.trim()}>
          {busy ? <Spinner size={14} /> : <Sparkles size={14} className="mr-1" />}
          {value.url ? '作り直す' : '作る'}
        </Button>
        {/* 押す前に分かるように書いておく。押してから減ったことに気づくのがいちばん困る */}
        <span className="text-xs text-muted-foreground">1枚 1{CREDIT_UNIT_SHORT}</span>
      </div>

      <BlockError message={error} />
    </div>
  )
}
