'use client'

import React, { useEffect, useState } from 'react'
import { X, Sparkles, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getItemTypes, updateItem, generateMeaning, generateTags, factCheckItem, isItemSkip } from '@/lib/api/items'
import { MEANING_LEVELS, meaningLevelLabel, DEFAULT_MEANING_LEVEL } from '@/lib/meaning-levels'
import { getTags } from '@/lib/api/tags'
import type { Item, ItemType } from '@/types/item'
import type { Tag } from '@/types/tag'
import { PropertyBlock, BlockAction, BlockError } from '@/components/features/items/PropertyBlock'
import { MeaningList } from '@/components/features/items/MeaningList'
import { ExampleList } from '@/components/features/items/ExampleList'
import { ItemPropertyBlocks } from '@/components/features/items/ItemPropertyBlocks'
import { ItemUsageBlock } from '@/components/features/items/ItemUsageBlock'
import { ItemReviewBlock } from '@/components/features/items/ItemReviewBlock'
import { CardViewPanel, applyBlockOrder } from '@/components/features/items/CardViewPanel'
import {
  PropertyDefinitionsPanel,
  PROPERTY_DEFINITIONS_PANEL_KEY,
} from '@/components/features/items/PropertyDefinitionsPanel'
import { useRightPanelStore } from '@/stores/rightPanel'
import { getItem, acknowledgeFactCheck } from '@/lib/api/items'

type ItemPropertiesProps = {
  item: Item
  /** 更新後のItemを親（詳細画面・ストア）へ反映する */
  onUpdated: (item: Item) => void
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
function FactCheckEvidence({ item }: { item: Item }) {
  const [open, setOpen] = useState(false)
  const claims = item.fact_check_claims ?? []
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
              <p className="text-xs font-medium text-muted-foreground">説明文の主張ごとの検証</p>
              <ul className="mt-1 space-y-1">
                {claims.map((claim, index) => {
                  const verdict = CLAIM_VERDICT[claim.verdict] ?? CLAIM_VERDICT.unsupported
                  return (
                    <li key={index} className="flex gap-1.5 text-xs leading-relaxed">
                      <span className={`shrink-0 font-medium ${verdict.className}`} aria-hidden>
                        {verdict.mark}
                      </span>
                      <span>
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
          ファクトチェック: 確認済み（
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
        ファクトチェック: {badge.label}
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
export function ItemProperties({ item, onUpdated }: ItemPropertiesProps) {
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

  // ブロックは「キー＋中身」の並びにしておく。並べ替えも表示切替も、
  // ここを差し替えるだけで効く（見せ方の指定はカード1枚ごとに持つ）
  const blocks: { key: string; label: string; node: React.ReactNode }[] = [
    {
      key: 'item_type',
      label: '種別',
      node: (
        <PropertyBlock title="種別" busy={savingType}>
          <select
            id="item-type"
            aria-label="種別"
            value={item.item_type?.id ?? ''}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={savingType || itemTypes.length === 0}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {itemTypes.length === 0 && <option value="">読み込み中...</option>}
            {item.item_type == null && itemTypes.length > 0 && <option value="">未設定</option>}
            {itemTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
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
          actions={
            <>
              <BlockAction
                icon={<Sparkles size={14} />}
                label={item.meaning ? '再生成' : 'AIで生成'}
                onClick={handleGenerateMeaning}
                busy={generatingMeaning}
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
        <PropertyBlock title="例">
          <ExampleList item={item} onUpdated={onUpdated} />
        </PropertyBlock>
      ),
    },
    {
      key: 'tags',
      label: 'タグ',
      node: (
        <PropertyBlock
          title="タグ"
          busy={savingTags}
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
                  style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: '#7a6432' }}
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

  const hiddenKeys = new Set(item.block_view?.hidden ?? [])
  const orderedBlocks = applyBlockOrder(blocks, item.block_view?.order)

  return (
    <div className="space-y-3">
      {orderedBlocks.filter((b) => !hiddenKeys.has(b.key)).map((b) => (
        <React.Fragment key={b.key}>{b.node}</React.Fragment>
      ))}

      {/* 利用者が定義した項目。作り付けの項目と同じブロックで並ぶ */}
      <ItemPropertyBlocks
        item={item}
        onUpdated={onUpdated}
        onOpenSettings={() => openSection({ key: PROPERTY_DEFINITIONS_PANEL_KEY, title: '項目の設定' })}
      />

      {/* この1枚だけの見え方。種別ぜんぶに効く「項目の設定」とは分けてある */}
      <CardViewPanel item={item} blocks={orderedBlocks.map(({ key, label }) => ({ key, label }))} onUpdated={onUpdated} />

      {/* 定義（種別ぜんぶに効く）は右パネルで触る。値はカードの各ブロックで */}
      <PropertyDefinitionsPanel
        itemType={item.item_type}
        onChanged={async () => onUpdated(await getItem(item.id))}
      />
    </div>
  )
}
