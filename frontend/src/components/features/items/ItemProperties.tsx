'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X, Sparkles, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  getItemTypes,
  updateItem,
  generateMeaning,
  generateExamples,
  generateTags,
  factCheckItem,
  isItemSkip,
} from '@/lib/api/items'
import { MEANING_LEVELS, meaningLevelLabel, DEFAULT_MEANING_LEVEL } from '@/lib/meaning-levels'
import { getTags } from '@/lib/api/tags'
import type { Item, ItemType } from '@/types/item'
import type { Tag } from '@/types/tag'
import { PropertyBlock, BlockAction, BlockError } from '@/components/features/items/PropertyBlock'
import { MeaningList } from '@/components/features/items/MeaningList'
import { ExampleList } from '@/components/features/items/ExampleList'
import { RelatedItems } from '@/components/features/items/RelatedItems'
import {
  PropertyToolsBlock,
  PropertyEntryBlock,
  PROPERTY_TOOLS_KEY,
} from '@/components/features/items/ItemPropertyBlocks'
import { PropertyAddBlock } from '@/components/features/items/PropertyAddBlock'

/** 出ていない項目の札。**必ずいちばん最後に置く**（読み終えた後に来るもの） */
const ADD_BLOCK_KEY = 'property-add'
import { splitByFilled } from '@/lib/items/property-value'
import { builtInBlockEmptiness } from '@/lib/items/block-empty'
import { omittedKeysForPreset } from '@/lib/block-visibility'
import { adminBlockKeys, defaultOmittedBlockKeys } from '@/lib/items/admin-blocks'
import { ItemUsageBlock } from '@/components/features/items/ItemUsageBlock'
import { ItemReviewBlock } from '@/components/features/items/ItemReviewBlock'
import { CardViewPanel, applyBlockOrder } from '@/components/features/items/CardViewPanel'
import {
  PropertyDefinitionsPanel,
  PROPERTY_DEFINITIONS_PANEL_KEY,
} from '@/components/features/items/PropertyDefinitionsPanel'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useSettingsStore } from '@/stores/settings'
import { cardDetailGridClass, useCardDetailColumns } from '@/hooks/useCardDetailColumns'
import { splitIntoColumns, evenColumnCounts } from '@/lib/items/column-split'
import { getItem, acknowledgeFactCheck, updateBlockView } from '@/lib/api/items'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoveHorizontal } from 'lucide-react'

/** 指定した鍵の札の直後へ挿す。見つからなければ先頭に置く */
function insertAfter<T extends { key: string }>(list: T[], afterKey: string, block: T): T[] {
  const at = list.findIndex((b) => b.key === afterKey)
  if (at < 0) return [ block, ...list ]

  return [ ...list.slice(0, at + 1), block, ...list.slice(at + 1) ]
}

type ItemPropertiesProps = {
  item: Item
  /** 更新後のItemを親（詳細画面・ストア）へ反映する */
  onUpdated: (item: Item) => void
  /**
   * 見出し語とイメージも、ほかの項目と同じ列に並べる。
   *
   * ページ側で別に描くのをやめ、**同じ札として**渡してもらう。
   * こうすると幅を変えたり、順を入れ替えたりが、ほかの項目とまったく同じに効く。
   */
  leadingBlocks?: { key: string; label: string; node: React.ReactNode }[]
  /** 狭い場所（右パネル）で開くとき。列を選ばせず1列にする */
  singleColumn?: boolean
  /**
   * そのカードを**最後まで読めているか**。
   *
   * 開いた直後に手元にあるのは一覧の要約で、項目も意味も並び順も入っていない。
   * それをそのまま描くと、読み終えた瞬間に**項目が現れ、並びが入れ替わり、
   * 地の色まで変わる**。読めるまでは、場所だけ取って見せない。
   *
   * 既定は true（読めているものとして扱う）。右パネル以外の呼び出しを変えないため。
   */
  settled?: boolean
}

const FACT_CHECK_BADGE: Record<string, { label: string; className: string }> = {
  correct: { label: '✓ 正しい', className: 'bg-green-100 text-green-700' },
  doubtful: { label: '⚠ 疑わしい', className: 'bg-yellow-100 text-yellow-800' },
  incorrect: { label: '✗ 誤り', className: 'bg-red-100 text-red-700' },
}

const CLAIM_VERDICT: Record<string, { mark: string; className: string }> = {
  supported: { mark: '✓', className: 'text-green-700' },
  unsupported: { mark: '?', className: 'text-yellow-800' },
  contradicted: { mark: '✗', className: 'text-red-700' },
}

/**
 * 判定の根拠（AIが独立に知っていたこと・主張ごとの検証結果）。
 *
 * 判定だけを出されても、当たっているのか外しているのか読み手には分からない。
 * 何を照らし合わせてそう言っているのかを見せて、最後は人が判断できるようにする。
 * 既定では畳んでおく（判定とコメントで足りる場面が多いため）。
 */
/** 説明そのものを指す名前（backend の GenerateFactCheckService::MEANING_FIELD と揃える） */
const MEANING_FIELD = '説明'

/**
 * 指摘の種類。**同じ「怪しい」でも直し方が違う**ので分けて出す。
 * fact は数が多く、付けると札だらけになるので出さない（既定として扱う）。
 */
const CLAIM_KIND_LABEL: Record<string, string> = {
  consistency: '食い違い',
  intent: '項目ちがい',
}

function FactCheckEvidence({ item }: { item: Item }) {
  const [open, setOpen] = useState(false)
  const claims = item.fact_check_claims ?? []
  // 見た範囲。項目まで見ていれば、その数を出す（説明ぶんの1件は数から外す）
  const fields = item.fact_check_fields ?? []
  const propertyCount = fields.filter((name) => name !== MEANING_FIELD).length
  const checkedScope = fields.length === 0 ? null
    : propertyCount === 0 ? '説明のみを確認'
    : `説明と ${propertyCount} 項目を確認`

  if (!item.fact_check_known && claims.length === 0) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {open ? '判定の根拠を隠す' : '判定の根拠を見る'}
      </button>
      {/* **何を見たうえでの判定かを、開かずに分かるようにする。**
          同じ「正しい」でも、説明だけ見たものと項目までぜんぶ見たものでは重みが違う */}
      {checkedScope && <span className="ml-2 text-xs text-muted-foreground">{checkedScope}</span>}

      {open && (
        <div className="mt-2 space-y-2 rounded border border-border bg-background px-2.5 py-2">
          {item.fact_check_known && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">この語について確認できたこと</p>
              <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap">{item.fact_check_known}</p>
            </div>
          )}
          {claims.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">主張ごとの検証</p>
              <ul className="mt-1 space-y-1">
                {claims.map((claim, index) => {
                  const verdict = CLAIM_VERDICT[claim.verdict] ?? CLAIM_VERDICT.unsupported
                  return (
                    <li key={index} className="flex gap-1.5 text-xs leading-relaxed">
                      <span className={`shrink-0 font-medium ${verdict.className}`} aria-hidden>
                        {verdict.mark}
                      </span>
                      <span>
                        {/* どこから出た指摘かを先に出す。カード全体を見たときは、
                            説明と項目の指摘が混ざるので、行だけでは追えない */}
                        {claim.field && claim.field !== MEANING_FIELD && (
                          <span className="mr-1 rounded bg-muted px-1 py-0.5 text-3xs text-muted-foreground">
                            {claim.field}
                          </span>
                        )}
                        {claim.kind && CLAIM_KIND_LABEL[claim.kind] && (
                          <span className="mr-1 rounded bg-muted px-1 py-0.5 text-3xs text-muted-foreground">
                            {CLAIM_KIND_LABEL[claim.kind]}
                          </span>
                        )}
                        {claim.text}
                        {claim.note && <span className="text-muted-foreground">（{claim.note}）</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 説明のAIファクトチェック結果（判定バッジ＋コメント＋訂正案）。未チェックなら何も出さない。
// 単語名・説明の訂正案がある場合は、確認のうえ実行するボタンを出す（自動上書きはしない）。
function FactCheckResult({
  item,
  onApplyMeaning,
  applyingMeaning,
  onApplyTitle,
  applyingTitle,
  onAcknowledge,
  acknowledging,
}: {
  item: Item
  onApplyMeaning?: (text: string) => void
  applyingMeaning?: boolean
  onApplyTitle?: (text: string) => void
  applyingTitle?: boolean
  onAcknowledge?: (acknowledged: boolean) => void
  acknowledging?: boolean
}) {
  const [confirmMeaning, setConfirmMeaning] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState(false)
  const badge = item.fact_check_status ? FACT_CHECK_BADGE[item.fact_check_status] : undefined
  if (!badge) return null

  // 人が読んで判断したものは畳む。判定は消さない（何を見て決めたのかが辿れなくなる）
  if (item.fact_check_acknowledged_at) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          AIチェック: 確認済み（
          {new Date(item.fact_check_acknowledged_at).toLocaleDateString('ja-JP')}）
        </span>
        {onAcknowledge && (
          <button
            type="button"
            onClick={() => onAcknowledge(false)}
            disabled={acknowledging}
            className="underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
          >
            もう一度見る
          </button>
        )}
      </div>
    )
  }
  const titleSuggestion = item.fact_check_title_suggestion
  const suggestion = item.fact_check_suggestion
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
        AIチェック: {badge.label}
      </span>
      {item.fact_check_comment && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{item.fact_check_comment}</p>
      )}
      <FactCheckEvidence item={item} />
      {onAcknowledge && (
        <button
          type="button"
          onClick={() => onAcknowledge(true)}
          disabled={acknowledging}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
          title="読んで判断したものとして畳みます。判定は残り、一覧の警告色だけ消えます"
        >
          {acknowledging ? <Spinner size={12} /> : null}
          確認済みにする
        </button>
      )}
      {titleSuggestion && onApplyTitle && (
        <div className="mt-2 rounded border border-border bg-background px-2.5 py-2">
          <p className="text-xs font-medium text-muted-foreground">単語名の訂正案</p>
          <p className="mt-1 text-sm font-medium">{titleSuggestion}</p>
          <Button
            size="sm"
            variant={confirmTitle ? 'destructive' : 'outline'}
            disabled={applyingTitle}
            onClick={() => {
              if (!confirmTitle) { setConfirmTitle(true); return }
              onApplyTitle(titleSuggestion)
            }}
            onBlur={() => setConfirmTitle(false)}
            className="mt-2"
          >
            {applyingTitle ? '変更中...' : confirmTitle ? `「${titleSuggestion}」に変更（確定）` : '単語名を変更'}
          </Button>
        </div>
      )}
      {suggestion && onApplyMeaning && (
        <div className="mt-2 rounded border border-border bg-background px-2.5 py-2">
          <p className="text-xs font-medium text-muted-foreground">説明の訂正案</p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{suggestion}</p>
          <Button
            size="sm"
            variant={confirmMeaning ? 'destructive' : 'outline'}
            disabled={applyingMeaning}
            onClick={() => {
              if (!confirmMeaning) { setConfirmMeaning(true); return }
              onApplyMeaning(suggestion)
            }}
            onBlur={() => setConfirmMeaning(false)}
            className="mt-2"
          >
            {applyingMeaning ? '書き換え中...' : confirmMeaning ? 'この内容で書き換える（確定）' : '説明を書き換える'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * カードのプロパティ（種別・意味）編集。
 * 種別は選択即保存、意味はインライン編集で保存する。
 */
export function ItemProperties({
  item,
  onUpdated,
  leadingBlocks = [],
  singleColumn = false,
  settled = true,
}: ItemPropertiesProps) {
  // 既定はアカウントの設定。この端末で選んでいればそちらが勝つ。
  //
  // **設定が届くまで描かない。** 届く前に組むと1列で並べてから2〜3列へ割れるので、
  // 札がいったん画面幅いっぱいに広がってから縮み、開くたびに紙面が跳ねて見えた
  const settings = useSettingsStore((s) => s.settings)
  const defaultColumns = settings?.card_detail_columns ?? 1
  const {
    columns: chosenColumns,
    change: changeColumns,
    ready: columnsReady,
  } = useCardDetailColumns(defaultColumns, settings !== null)
  // **並びも中身も決まってから見せる。**
  // 列（端末の設定）とカード本体（項目・並び順）の両方が要る
  const readyToShow = columnsReady && settled
  // **狭い場所では必ず1列。** 右パネルは幅が限られていて、
  // 2列にすると1列あたりが半分になり、説明のような長い項目が読めなくなる
  const columns = singleColumn ? 1 : chosenColumns
  const openSection = useRightPanelStore((s) => s.openSection)
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [savingType, setSavingType] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)

  const [meaningError, setMeaningError] = useState<string | null>(null)
  const [generatingMeaning, setGeneratingMeaning] = useState(false)
  const [meaningLevel, setMeaningLevel] = useState<string>(item.meaning_level ?? DEFAULT_MEANING_LEVEL)
  const [applyingSuggestion, setApplyingSuggestion] = useState(false)
  const [applyingTitle, setApplyingTitle] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)

  // 指摘を「読んで判断した」と記録する。代表の1件に対して行う
  // （一覧の警告色も代表を見ているため）。
  const handleAcknowledge = async (acknowledged: boolean) => {
    const target = item.meanings?.[0]
    if (!target) return

    setAcknowledging(true)
    setMeaningError(null)
    try {
      await acknowledgeFactCheck(item.id, target.id, acknowledged)
      onUpdated(await getItem(item.id))
    } catch {
      setMeaningError('確認済みにできませんでした。もう一度お試しください。')
    } finally {
      setAcknowledging(false)
    }
  }

  // ファクトチェックの訂正案で説明を書き換える（確認後に呼ばれる）。
  const handleApplyFactCheckSuggestion = async (text: string) => {
    setApplyingSuggestion(true)
    setMeaningError(null)
    try {
      const updated = await updateItem(item.id, { meaning: text })
      onUpdated(updated)
    } catch {
      setMeaningError('説明の書き換えに失敗しました。もう一度お試しください。')
    } finally {
      setApplyingSuggestion(false)
    }
  }

  // ファクトチェックの訂正案で単語名を変更する（確認後に呼ばれる）。
  const handleApplyTitleSuggestion = async (text: string) => {
    setApplyingTitle(true)
    setMeaningError(null)
    try {
      const updated = await updateItem(item.id, { title: text })
      onUpdated(updated)
    } catch {
      setMeaningError('単語名の変更に失敗しました。もう一度お試しください。')
    } finally {
      setApplyingTitle(false)
    }
  }

  // Wikipedia の項目を持っていて、中身が入っているか。
  // 持っていれば、意味・説明はそれを下敷きに書かれる
  const hasWikipedia = (item.properties ?? []).some(
    (entry) => entry.value_type === 'wikipedia' && entry.value != null
  )

  const handleGenerateMeaning = async () => {
    setGeneratingMeaning(true)
    setMeaningError(null)
    try {
      const updated = await generateMeaning(item.id, meaningLevel)
      if (!isItemSkip(updated)) onUpdated(updated)
    } catch {
      setMeaningError('意味の生成に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setGeneratingMeaning(false)
    }
  }

  const [generatingExamples, setGeneratingExamples] = useState(false)
  const [examplesError, setExamplesError] = useState<string | null>(null)
  const hasMeanings = (item.meanings?.length ?? 0) > 0

  // 例文の無いものだけまとめて書く。1件ずつの書き直しは ExampleList 側の行から。
  // 手で書いた例文をここで上書きしないのは、まとめて押したときの被害が大きいため
  const handleGenerateExamples = async () => {
    setGeneratingExamples(true)
    setExamplesError(null)
    try {
      onUpdated(await generateExamples(item.id))
    } catch (e) {
      const detail = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setExamplesError(detail ?? '例文を書けませんでした。時間を置いて再度お試しください。')
    } finally {
      setGeneratingExamples(false)
    }
  }

  const [checkingFact, setCheckingFact] = useState(false)

  // 説明が事実として正しいかをAIでチェックする（結果は FactCheckResult に反映される）
  const handleFactCheck = async () => {
    setCheckingFact(true)
    setMeaningError(null)
    try {
      const updated = await factCheckItem(item.id)
      if (!isItemSkip(updated)) onUpdated(updated)
    } catch {
      setMeaningError('AIチェックに失敗しました。時間を置いて再度お試しください。')
    } finally {
      setCheckingFact(false)
    }
  }

  const [tagDraft, setTagDraft] = useState('')
  const [tagFocused, setTagFocused] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [generatingTags, setGeneratingTags] = useState(false)

  const tags = item.tags ?? []

  // 既存タグ（入力候補用）
  const loadAllTags = () => {
    getTags()
      .then(setAllTags)
      .catch(() => {})
  }
  useEffect(() => {
    loadAllTags()
  }, [])

  // まだ付いていない既存タグを候補に出す。
  // 未入力（フォーカスのみ）ならよく使われる順、入力中は該当するものを絞り込む。
  const tagQuery = tagDraft.trim().toLowerCase()
  const tagSuggestions = allTags
    .filter((t) => !tags.some((cur) => cur.name.toLowerCase() === t.name.toLowerCase()))
    .filter((t) => tagQuery.length === 0 || t.name.toLowerCase().includes(tagQuery))
    .sort((a, b) => b.item_count - a.item_count)
  const showTagSuggestions = tagFocused && tagSuggestions.length > 0

  const saveTags = async (names: string[]) => {
    setSavingTags(true)
    setTagError(null)
    try {
      const updated = await updateItem(item.id, { tags: names })
      onUpdated(updated)
      loadAllTags()
    } catch {
      setTagError('タグの更新に失敗しました')
    } finally {
      setSavingTags(false)
    }
  }

  const addTagName = async (raw: string) => {
    const name = raw.trim()
    if (!name) return
    setTagDraft('')
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return
    await saveTags([...tags.map((t) => t.name), name])
  }

  const handleRemoveTag = async (tagId: string) => {
    await saveTags(tags.filter((t) => t.id !== tagId).map((t) => t.name))
  }

  // AI でタグを生成。既存タグは消さず union で追加される（サーバー側で実施）。
  const handleGenerateTags = async () => {
    setGeneratingTags(true)
    setTagError(null)
    try {
      const updated = await generateTags(item.id)
      if (!isItemSkip(updated)) onUpdated(updated)
      loadAllTags()
    } catch {
      setTagError('タグの生成に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setGeneratingTags(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getItemTypes()
      .then((types) => {
        if (!cancelled) setItemTypes(types)
      })
      .catch(() => {
        // 種別一覧の取得失敗時はセレクタを出さない（致命的ではない）
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleTypeChange = async (itemTypeId: string) => {
    if (!itemTypeId || itemTypeId === item.item_type?.id) return
    setSavingType(true)
    setTypeError(null)
    try {
      const updated = await updateItem(item.id, { item_type_id: itemTypeId })
      onUpdated(updated)
    } catch {
      setTypeError('種別の更新に失敗しました')
    } finally {
      setSavingType(false)
    }
  }

  // **まだ書いていない札は地を落とす。**
  //
  // 自由プロパティだけ灰色にしていたので、作り付けの札（種別・意味・例・タグ）は
  // 書いても書かなくても同じ地だった。上から読んでいって、どこまで書いたのかが
  // 分かるのは片方だけ、という状態になっていた。判定は lib に出してある
  // **読めていないうちは、どれも空と決めない。**
  // 決めてしまうと、読めていないだけの札が灰色になり、読み終えた瞬間に白へ戻る
  const blockEmpty = builtInBlockEmptiness(item, settled)

  // ブロックは「キー＋中身」の並びにしておく。並べ替えも表示切替も、
  // ここを差し替えるだけで効く（見せ方の指定はカード1枚ごとに持つ）
  const blocks: { key: string; label: string; node: React.ReactNode }[] = [
    {
      key: 'item_type',
      label: '種別',
      node: (
        <PropertyBlock title="種別" busy={savingType} empty={blockEmpty.item_type}>
          {/*
            候補を並べて1つ選ぶ。畳んだ一覧から選ぶ形（select）だと、
            **開くまで何が選べるのか分からない**。種別は数が少なく、
            持てる項目そのものが変わる選択なので、選択肢が見えているほうがよい。
          */}
          {itemTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          ) : (
            <div role="radiogroup" aria-label="種別" className="flex flex-wrap gap-1.5">
              {itemTypes.map((type) => {
                const active = item.item_type?.id === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => !active && handleTypeChange(type.id)}
                    disabled={savingType}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                      active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                  >
                    {type.label}
                  </button>
                )
              })}
            </div>
          )}
          {item.item_type == null && itemTypes.length > 0 && (
            <p className="text-xs text-muted-foreground">まだ決めていません。選ぶと、その種別の項目が出ます。</p>
          )}
          <BlockError message={typeError} />
        </PropertyBlock>
      ),
    },
    {
      key: 'meanings',
      label: '意味・説明',
      node: (
        <PropertyBlock
          title="意味・説明"
          empty={blockEmpty.meanings}
          actions={
            <>
              <BlockAction
                icon={<Sparkles size={14} />}
                label={item.meaning ? '再生成' : 'AIで生成'}
                onClick={handleGenerateMeaning}
                busy={generatingMeaning}
                // Wikipedia を持っていれば、それを下敷きに書く。
                // 何を見て書いたのかが分からないと、直してよいのかが判断できない
                title={
                  hasWikipedia
                    ? 'Wikipedia の冒頭を下敷きに書きます（書き写さず、短く言い直します）'
                    : undefined
                }
              />
              {item.meaning && (
                <BlockAction
                  icon={<ShieldCheck size={14} />}
                  label="AIチェック"
                  onClick={handleFactCheck}
                  busy={checkingFact}
                  title="説明が事実として正しいかAIでチェックし、訂正案を出します"
                />
              )}
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">AIで生成する詳しさ:</span>
            {MEANING_LEVELS.map((lv) => {
              const active = meaningLevel === lv
              return (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setMeaningLevel(lv)}
                  disabled={generatingMeaning}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                    active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                  style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                  aria-pressed={active}
                >
                  {meaningLevelLabel(lv)}
                </button>
              )
            })}
          </div>

          <MeaningList
            item={item}
            onUpdated={onUpdated}
            primaryExtra={
              <FactCheckResult
                item={item}
                onApplyMeaning={handleApplyFactCheckSuggestion}
                applyingMeaning={applyingSuggestion}
                onApplyTitle={handleApplyTitleSuggestion}
                applyingTitle={applyingTitle}
                onAcknowledge={handleAcknowledge}
                acknowledging={acknowledging}
              />
            }
          />
          <BlockError message={meaningError} />
        </PropertyBlock>
      ),
    },
    {
      // 例文は意味・説明とは別の項目として並べる。番号で対応が追える
      key: 'examples',
      label: '例',
      node: (
        <PropertyBlock
          title="例"
          empty={blockEmpty.examples}
          actions={
            hasMeanings && (
              <BlockAction
                icon={<Sparkles size={14} />}
                label="空いている例をAIで書く"
                onClick={handleGenerateExamples}
                busy={generatingExamples}
                title="例文の無いものだけ書きます。1件ずつの書き直しは各行から"
              />
            )
          }
        >
          <ExampleList item={item} onUpdated={onUpdated} />
          <BlockError message={examplesError} />
        </PropertyBlock>
      ),
    },
    {
      // 関連カード。つながりに向きは無いので、どちらのカードからも同じものが見える
      key: 'relations',
      label: '関連カード',
      node: <RelatedItems item={item} />,
    },
    {
      key: 'tags',
      label: 'タグ',
      node: (
        <PropertyBlock
          title="タグ"
          busy={savingTags}
          empty={blockEmpty.tags}
          actions={
            <BlockAction
              icon={<Sparkles size={14} />}
              label="AIで生成"
              onClick={handleGenerateTags}
              busy={generatingTags}
              disabled={savingTags}
            />
          }
        >
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                  style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--tag-ink)' }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    disabled={savingTags}
                    aria-label={`タグ「${tag.name}」を外す`}
                    className="hover:text-foreground transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative max-w-xs">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onFocus={() => setTagFocused(true)}
              onBlur={() => setTagFocused(false)}
              onKeyDown={(e) => {
                // IME変換確定の Enter では追加しない（確定後、再度 Enter で設定）
                if (e.key !== 'Enter') return
                if (e.nativeEvent.isComposing) return
                e.preventDefault()
                addTagName(tagDraft)
              }}
              disabled={savingTags}
              placeholder="タグを入力して Enter"
              aria-label="タグを追加"
              autoComplete="off"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {showTagSuggestions && (
              <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {tagSuggestions.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      // blur より先に発火させてクリックを成立させる
                      onMouseDown={(e) => { e.preventDefault(); addTagName(t.name) }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{t.item_count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <BlockError message={tagError} />
        </PropertyBlock>
      ),
    },
    {
      key: 'reviews',
      label: '学習の記録',
      node: <ItemReviewBlock itemId={item.id} />,
    },
    {
      key: 'usages',
      label: '使っている場所',
      node: <ItemUsageBlock itemId={item.id} />,
    },
  ]

  // いま足したばかりの項目。Wikipedia を足したときだけ、押さずとも調べ始める。
  // 既にあるものには効かせない（カードを開くたびに引き直したら、
  // 手で選んだ記事が黙って別のものに変わる）
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null)

  // 利用者が定義した項目も、作り付けの項目と同じ一覧に混ぜる。
  // 混ぜないと、並べ替えも出し入れも作り付けのものにしか効かない
  const openSettings = () => openSection({ key: PROPERTY_DEFINITIONS_PANEL_KEY, title: '項目の設定' })

  // **書いたものだけを本文に並べる。**
  //
  // 定義した項目を全部並べていたので、20 定義していれば書いていない18件が
  // 「未設定」と並んでカード詳細が縦に伸びていた。
  // 読みに来た人が空欄をかき分けることになる。
  //
  // 押されたものは、その場で本文へ出す（書けるようにする）
  const [revealed, setRevealed] = useState<string[]>([])
  const { filled, empty } = splitByFilled(item.properties ?? [])

  /**
   * **新しく作られた項目は、そのまま書ける状態にする。**
   *
   * ライトパネルから項目を作ると、カードには「未設定」として増えるだけで、
   * もう一度こちらで押さないと書けなかった。**足したつもりのものが出てこない。**
   *
   * どこから作られたかを伝え合うのではなく、
   * **前に見た鍵に無いものが増えたら、それが新しいもの**と読む。
   * 作る道が増えても、こちらを直さずに済む
   */
  const seenKeys = useRef<Set<string> | null>(null)
  useEffect(() => {
    const keys = new Set((item.properties ?? []).map((entry) => entry.key))
    const before = seenKeys.current
    seenKeys.current = keys
    if (before === null) return

    const fresh = [...keys].filter((key) => !before.has(key))
    if (fresh.length > 0) setRevealed((current) => [...new Set([...current, ...fresh])])
  }, [item.properties])
  const shownEmpty = empty.filter((entry) => revealed.includes(entry.key))
  const hiddenEmpty = empty.filter((entry) => !revealed.includes(entry.key))

  const customBlocks = [...filled, ...shownEmpty].map((entry) => ({
    key: `prop:${entry.key}`,
    label: entry.label,
    node: (
      <PropertyEntryBlock
        item={item}
        entry={entry}
        onUpdated={onUpdated}
        autoLookup={justCreatedKey === entry.key}
      />
    ),
  }))

  const addBlock = {
    key: ADD_BLOCK_KEY,
    // **「未設定」と「まだ無い」を分けない。** 読む側にとっては同じ
    // 「まだ出ていない項目」で、どちらかは中の作りの話でしかない
    label: '出ていない項目',
    node: (
      <PropertyAddBlock
        item={item}
        entries={hiddenEmpty}
        onReveal={(key) => setRevealed((current) => [...current, key])}
        onUpdated={onUpdated}
      />
    ),
  }

  const toolsBlock = {
    key: PROPERTY_TOOLS_KEY,
    label: '項目の道具',
    node: (
      <PropertyToolsBlock
        item={item}
        onUpdated={onUpdated}
        onOpenSettings={openSettings}
        onCreated={setJustCreatedKey}
      />
    ),
  }

  // 道具立ては最後。まとめて埋める操作は、項目を見たあとで押すもの。
  //
  // ただし**項目が1つも無いときだけは先に出す**。0件のときは「見たあと」が
  // 存在せず、最後に置くと画面の末尾までたどり着いた人にしか見えない。
  // 実際、本番では所有者以外の全員が0件のままだった。
  // ここは道具ではなく、機能があることを知らせる場所になる
  const hasProperties = customBlocks.length > 0
  // 追加できる項目は、**書いたものの後ろ**に置く。
  // 前に置くと、読みに来た人が毎回それを越えてから本文へ入ることになる
  // **作られていない項目もここに並ぶ**ので、未設定が0件でも出す
  const addBlocks = [ addBlock ]
  // 0件のときは種別のすぐ下に置く。位置ではなく鍵で挿すのは、
  // 作り付けの並びを変えたときに黙ってずれないようにするため
  const allBlocks = hasProperties
    ? [ ...leadingBlocks, ...blocks, ...customBlocks, ...addBlocks, toolsBlock ]
    : [ ...leadingBlocks, ...insertAfter(blocks, 'item_type', toolsBlock), ...addBlocks ]

  // − に入れたもの（このカードでは持たない）と、＋の中で畳んだもの。
  // どちらも出さないが、意味が違うので分けて持つ。
  //
  // まだ一度も触っていないカードに既定のひな型が当たっているときは、
  // ひな型に無いものを「持たない」に回す（どんなブロックがあるかを知っているのは画面側）
  const fromPreset = item.block_view?.from_preset === true
  const presetKeys = new Set(item.block_view?.order ?? [])
  // 管理のための札（学習の記録・使っている場所・役割が管理要素の項目）は、
  // **既定では本文に置かない。** 覚えたいものと管理用の数字が同じ面に並ぶと、
  // 最初に読むべきものがその分だけ後ろへ押される。中身は「情報」から見られる。
  //
  // 一度でも並べたカードには手を出さない（整えた並びを黙って崩さない）
  const defaultOmitted = defaultOmittedBlockKeys(adminBlockKeys(item.properties), item.block_view?.order)
  const omittedKeys = fromPreset
    ? omittedKeysForPreset(allBlocks.map((b) => b.key), presetKeys)
    : new Set([ ...(item.block_view?.omitted ?? []), ...defaultOmitted ])
  const hiddenKeys = new Set(item.block_view?.hidden ?? [])
  const adopted = allBlocks.filter((b) => !omittedKeys.has(b.key))
  // **「出ていない項目」は必ずいちばん最後。**
  //
  // 並べ替えの対象にすると、上へ動かせてしまう。だが読みに来た人にとっては
  // 「書いてあるもの」を読み終えた後に来るものなので、前に置く理由が無い。
  // 並びを保存している人の順も、ここでだけ後ろへ回す
  const ordered = applyBlockOrder(adopted, item.block_view?.order)
  const orderedBlocks = [
    ...ordered.filter((block) => block.key !== ADD_BLOCK_KEY),
    ...ordered.filter((block) => block.key === ADD_BLOCK_KEY),
  ]
  const visibleBlocks = orderedBlocks.filter((b) => !hiddenKeys.has(b.key))

  // 4px 動かすまでは並べ替えを始めない。項目の中のボタンを押すだけのつもりが
  // 指が滑って並びまで変わる、を防ぐ（「表示」パネルと同じ決まり）
  const blockSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // 札ごとの幅。1列のときは変えられない（並べる先が無い）
  const spans = item.block_view?.spans ?? {}
  // 列への振り分け。**このカード1枚の決め方**なので、端末ではなくカードに持つ
  const autoFlow = item.block_view?.auto_flow !== false
  const columnCounts = item.block_view?.column_counts ?? []

  // 自動へ戻すときも、決めた数は消さない（また切ったときに戻せる）
  const changeFlow = async (nextAuto: boolean, nextCounts?: number[]) => {
    try {
      onUpdated(
        await updateBlockView(item.id, {
          hidden: [...hiddenKeys],
          order: orderedBlocks.map((b) => b.key),
          omitted: [...omittedKeys],
          spans,
          auto_flow: nextAuto,
          column_counts: nextCounts ?? columnCounts,
        })
      )
    } catch {
      // 失敗しても画面は壊さない。次の操作でやり直せる
    }
  }

  const changeSpan = async (key: string, next: number) => {
    const clamped = Math.max(1, Math.min(next, columns))
    if ((spans[key] ?? 1) === clamped) return

    // 1（既定）は書かない。全部の札を書き出すと、項目が増えるほど保存が肥る
    const nextSpans = { ...spans }
    if (clamped > 1) nextSpans[key] = clamped
    else delete nextSpans[key]

    try {
      onUpdated(
        await updateBlockView(item.id, {
          hidden: [...hiddenKeys],
          order: orderedBlocks.map((b) => b.key),
          omitted: [...omittedKeys],
          spans: nextSpans,
        })
      )
    } catch {
      // 幅が保存できなくても、いま見ているものは壊さない
    }
  }

  const handleBlockDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = orderedBlocks.findIndex((b) => b.key === active.id)
    const to = orderedBlocks.findIndex((b) => b.key === over.id)
    if (from < 0 || to < 0) return

    const nextOrder = arrayMove(orderedBlocks, from, to).map((b) => b.key)
    try {
      onUpdated(
        await updateBlockView(item.id, {
          hidden: [...hiddenKeys],
          order: nextOrder,
          omitted: [...omittedKeys],
        })
      )
    } catch {
      // 並べ替えが保存できなくても、いま見ているものは壊さない。次に開けば元の並び
    }
  }

  return (
    <div className="space-y-3">
      {/* 列数はこの端末で覚える。既定はアカウントの設定から来る。
          並べ替えはここでも「表示」パネルでもできる。書き先は同じ block_view.order
          なので、どちらで動かしても両方に効く（片方だけ古い、が起きない） */}
      {(
      <DndContext sensors={blockSensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
        {/* 列の中を上から順に流すので、掴んだものは**縦に**動く。
            四角く並べる前提の作法（rectSortingStrategy）だと、
            上下に動かしたつもりが左右に飛ぶ */}
        <SortableContext items={visibleBlocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
          {autoFlow ? (
            // 列が決まるまでは、場所は取ったまま見せない。
            // 隠さずに描くと、1列→2〜3列の組み替えがそのまま目に映る
            <div className={`${cardDetailGridClass(columns)} ${readyToShow ? '' : 'invisible'}`}>
              {visibleBlocks.map((b) => (
                <SortableBlock
                  key={b.key}
                  id={b.key}
                  span={Math.min(spans[b.key] ?? 1, columns)}
                  columns={columns}
                  onSpanChange={(next) => changeSpan(b.key, next)}
                >
                  {b.node}
                </SortableBlock>
              ))}
            </div>
          ) : (
            // 自分で決めた数で列に分ける。**幅（何列ぶん）はここでは効かない**
            // （1枚の札は1つの列に属するため）。並べ替えは従来どおり効く
            <div
              className={`grid gap-3 ${readyToShow ? '' : 'invisible'}`}
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {splitIntoColumns(visibleBlocks, columnCounts, columns).map((column, index) => (
                <div key={index} className="space-y-3">
                  {column.map((b) => (
                    <SortableBlock key={b.key} id={b.key} span={1} columns={1}>
                      {b.node}
                    </SortableBlock>
                  ))}
                </div>
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>
      )}

      {/* この1枚だけの見え方。種別ぜんぶに効く「項目の設定」とは分けてある */}
      <CardViewPanel
        item={item}
        blocks={orderedBlocks.map(({ key, label }) => ({ key, label }))}
        columns={columns}
        onColumnsChange={changeColumns}
        singleColumn={singleColumn}
        autoFlow={autoFlow}
        columnCounts={columnCounts}
        onFlowChange={(nextAuto) =>
          changeFlow(
            nextAuto,
            // 自分で決める側へ切り替えるときだけ、いまの見え方に近い数から始める
            nextAuto || columnCounts.length > 0
              ? undefined
              : evenColumnCounts(visibleBlocks.length, columns)
          )
        }
        onColumnCountsChange={(next) => changeFlow(false, next)}
        omitted={allBlocks.filter((b) => omittedKeys.has(b.key)).map(({ key, label }) => ({ key, label }))}
        onUpdated={onUpdated}
      />

      {/* 定義（種別ぜんぶに効く）は右パネルで触る。値はカードの各ブロックで */}
      <PropertyDefinitionsPanel
        itemType={item.item_type}
        onChanged={async () => onUpdated(await getItem(item.id))}
      />
    </div>
  )
}

/** 幅に対応する格子の指定。静的な文字列で書く（Tailwind は組み立てた名前を拾えない） */
/**
 * 幅の指定。
 *
 * 列の中を流す並べ方では、**2列ぶんだけ**という幅は作れない（そういう仕組みが無い）。
 * 1列ぶんか、全部の列にまたがるか、の2つになる。
 * 「広げたい」という意図は全幅で満たせるので、2以上はすべて全幅に倒す。
 */
const SPAN_CLASSES: Record<number, string> = {
  1: '',
  2: '[column-span:all]',
  3: '[column-span:all]',
}

/**
 * 並べ替えられる項目の器。
 *
 * つまみは出さない。項目そのものを掴んで動かせるほうが早く、
 * つまみを置くと項目ごとに余白が要る。中のボタンを押すだけのときは、
 * 4px 動かすまで並べ替えが始まらないので邪魔にならない。
 */
function SortableBlock({
  id,
  span,
  columns,
  onSpanChange,
  children,
}: {
  id: string
  span: number
  columns: number
  onSpanChange?: (next: number) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const boxRef = useRef<HTMLDivElement | null>(null)

  /**
   * 右下のつまみを引いて幅を変える。
   *
   * 自由な幅にはしない。列に嵌める（1列ぶん・2列ぶん…）ので、
   * どこで放しても並びが崩れない。自由な幅だと、札ごとに端が揃わず、
   * 揃えるために全部を手で直すことになる。
   */
  const startResize = (event: React.PointerEvent) => {
    if (columns <= 1) return
    event.preventDefault()
    event.stopPropagation()

    const box = boxRef.current
    if (!box) return
    const left = box.getBoundingClientRect().left
    // いまの幅から、1列ぶんの幅を割り出す
    const cell = box.getBoundingClientRect().width / span

    const move = (e: PointerEvent) => {
      const next = Math.round((e.clientX - left) / cell)
      onSpanChange?.(Math.max(1, Math.min(next, columns)))
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        boxRef.current = node
      }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      // 掴む役は下のつまみだけに持たせる。ここに持たせると、
      // **本文をなぞった瞬間に札が動き出して、文字を選べない**
      className={`group/block relative select-text ${SPAN_CLASSES[span] ?? ''}`}
    >
      {children}

      {/* 並べ替えのつまみ。触ったときだけ出す。
          札そのものを掴めるようにすると読めなくなるので、掴む場所を1点に絞る。
          キーボードでも掴めるよう、目印（attributes）もここに付ける */}
      <button
        type="button"
        aria-label="この札を動かす"
        className="absolute left-1 top-1 hidden h-5 w-5 cursor-grab touch-none items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity focus-visible:flex focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)] group-hover/block:flex group-hover/block:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={12} />
      </button>

      {/* つまみは常には出さない。触ったときだけ出れば足りるし、
          札ごとに常時出ていると、読むときに邪魔になる */}
      {columns > 1 && onSpanChange && (
        <span
          onPointerDown={startResize}
          role="separator"
          aria-label="幅を変える"
          aria-valuenow={span}
          aria-valuemin={1}
          aria-valuemax={columns}
          title="引いて幅を変える"
          className="absolute bottom-1 right-1 hidden h-4 w-4 cursor-ew-resize items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/block:flex group-hover/block:opacity-100"
        >
          {/* 掴んで動かすつまみ（左上）と同じ絵にしない。
              **同じ絵は同じことをする**と読まれる。こちらは横に引いて幅を変える */}
          <MoveHorizontal size={12} />
        </span>
      )}
    </div>
  )
}
