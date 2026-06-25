'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { createItem } from '@/lib/api/items'
import { trackEvent } from '@/lib/analytics'
import { getViews, createView, addDeckCard } from '@/lib/api/views'
import { getSettings } from '@/lib/api/settings'
import { useItemsStore } from '@/stores/items'
import { useBillingStore } from '@/stores/billing'
import { estimatedCards } from '@/lib/billing'
import { STYLE_OPTIONS, CUSTOM_PROMPT_MAX_LENGTH } from '@/lib/item-styles'
import { MEANING_LEVELS, meaningLevelLabel, DEFAULT_MEANING_LEVEL } from '@/lib/meaning-levels'
import type { View } from '@/types/view'

const MAX_TITLE_LENGTH = 100

function parseTitles(raw: string): string[] {
  return raw
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function CreateItemForm() {
  const router = useRouter()
  const upsertItem = useItemsStore((state) => state.upsertItem)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)
  const [input, setInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [style, setStyle] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [forceGenerate, setForceGenerate] = useState(false)
  // タグ生成・説明生成は既定ON（ユーザー設定があればそれで上書き）
  const [generateMeaning, setGenerateMeaning] = useState(true)
  const [meaningLevel, setMeaningLevel] = useState<string>(DEFAULT_MEANING_LEVEL)
  const [generateTags, setGenerateTags] = useState(true)
  const [deckViews, setDeckViews] = useState<View[]>([])
  const [createNewDeck, setCreateNewDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // 既存デッキ一覧と、意味自動生成のデフォルト値（ユーザー設定）を読み込む
  useEffect(() => {
    getViews().then((vs) => setDeckViews(vs.filter((v) => v.view_type === 'deck'))).catch(() => {})
    getSettings()
      .then((s) => {
        setGenerateMeaning(s.auto_generate_meanings)
        setGenerateTags(s.auto_generate_tags)
      })
      .catch(() => {})
    fetchBilling()
  }, [fetchBilling])

  const toggleDeck = (id: string) => {
    setSelectedDeckIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  const titles = parseTitles(input)
  const wordCount = titles.length
  const hasTooLongTitle = titles.some((t) => t.length > MAX_TITLE_LENGTH)
  const tagNames = tagsInput.split(/[\s,、]+/).map((s) => s.trim()).filter(Boolean)
  // 残クレジットからおおよその作成可能枚数を出し、入力件数が超える場合は警告する
  const remainingCards = billing ? estimatedCards(billing.available_credits) : null
  const willExceedCredits = remainingCards !== null && wordCount > remainingCards

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (titles.length === 0) return
    if (hasTooLongTitle) {
      setApiError(`1単語あたり${MAX_TITLE_LENGTH}文字以内で入力してください。`)
      return
    }
    setApiError(null)
    setSubmitting(true)
    setProgress({ done: 0, total: titles.length })

    try {
      // 送信先デッキ（view_type='deck' のビュー）を組み立てる。新規作成する場合は先に作る
      // （名前未入力ならデフォルトのナンバリング名を付ける）。
      const targetViewIds = [...selectedDeckIds]
      if (createNewDeck) {
        const name = newDeckName.trim() || `デッキ ${deckViews.length + 1}`
        const created = await createView(name, 'deck')
        targetViewIds.push(created.id)
      }

      for (let i = 0; i < titles.length; i++) {
        const item = await createItem(titles[i], forceGenerate, tagNames.length ? tagNames : undefined, {
          style: style || undefined,
          customPrompt: customPrompt.trim() || undefined,
          generateMeaning,
          generateMeaningLevel: generateMeaning ? meaningLevel : undefined,
          generateTags,
        })
        // 作成したカードを選択中のデッキ（deck-view）へ追加する
        for (const viewId of targetViewIds) {
          await addDeckCard(viewId, item.id)
        }
        upsertItem(item)
        setProgress({ done: i + 1, total: titles.length })
      }
      // 単語そのものは送らず、作成件数とオプション有無のみ計測する
      trackEvent('create_items', {
        count: titles.length,
        force_generate: forceGenerate,
        with_meaning: generateMeaning,
        with_tags: generateTags,
      })
      fetchBilling() // 消費後の残高を更新（ヘッダー等の表示に反映）
      router.push('/items')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      const msg =
        axiosErr?.response?.data?.error ??
        axiosErr?.response?.data?.errors?.[0] ??
        'カードの作成に失敗しました。もう一度試してください。'
      setApiError(msg)
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titles" required>単語・概念を入力</Label>
        <div className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
          <p>具体的な名詞や場面が思い浮かぶ言葉ほど、画像化に成功しやすいです。</p>
          <p>例: <span className="font-medium text-foreground">富士山 / API / 光合成 / 細胞分裂</span></p>
        </div>
        <textarea
          id="titles"
          className="w-full min-h-[180px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          placeholder={"photosynthesis\nAPI\nmitosis\n\n改行・カンマ区切りで複数入力できます"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        {wordCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {wordCount}件の単語を認識しました
          </p>
        )}
        {wordCount === 0 && (
          <p className="text-xs text-muted-foreground">
            抽象的すぎる語や意味のない文字列は失敗しやすいため、まずは具体的な単語から試してください。
          </p>
        )}
        {hasTooLongTitle && (
          <p className="text-xs text-destructive">
            1単語あたり{MAX_TITLE_LENGTH}文字を超えています。区切り直すか短くしてください。
          </p>
        )}
        {remainingCards !== null && (
          willExceedCredits ? (
            <p className="text-xs text-destructive">
              クレジットが不足します（残り約 {remainingCards} 枚 / 入力 {wordCount} 件）。
              <Link href="/billing" className="ml-1 underline">プランを見る</Link>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              残りクレジット {billing?.available_credits}（あと約 {remainingCards} 枚作成できます）
            </p>
          )
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">タグ（任意）</Label>
        <input
          id="tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          disabled={submitting}
          placeholder="スペース区切りで入力（例: 英語 IT）"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {tagNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {tagNames.length}個のタグを、作成するすべてのカードに付与します
          </p>
        )}
      </div>

      {/* スタイル（プリセット） */}
      <div className="space-y-2">
        <Label>スタイル（任意）</Label>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => {
            const active = style === opt.value
            return (
              <button
                key={opt.value || 'default'}
                type="button"
                onClick={() => setStyle(opt.value)}
                disabled={submitting}
                className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                  active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={active ? { backgroundColor: 'var(--palace)' } : undefined}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">作成するすべてのカードに同じスタイルが適用されます。</p>
      </div>

      {/* カスタム指示（自由入力） */}
      <div className="space-y-2">
        <Label htmlFor="custom-prompt">追加の指示（任意）</Label>
        <input
          id="custom-prompt"
          type="text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          disabled={submitting}
          maxLength={CUSTOM_PROMPT_MAX_LENGTH}
          placeholder="例: 背景は白、やさしい色合いで"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">プロンプトに追記され、画像の雰囲気を調整できます。</p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={forceGenerate}
          onChange={(e) => setForceGenerate(e.target.checked)}
          disabled={submitting}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">既存キャッシュを使わずに生成する</span>
          <span className="block text-xs text-muted-foreground">
            同じ単語の保存済み画像があっても再生成します。通常はオフのままで問題ありません。
          </span>
        </span>
      </label>

      {/* 意味・説明の自動生成 */}
      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={generateMeaning}
          onChange={(e) => setGenerateMeaning(e.target.checked)}
          disabled={submitting}
        />
        <span className="flex-1 space-y-2">
          <span className="block text-sm font-medium">各カードの意味・説明をAIで自動生成する</span>
          <span className="block text-xs text-muted-foreground">
            作成するすべてのカードについて、意味・説明をAIで生成します。あとから個別に生成・編集することもできます。
          </span>
          {generateMeaning && (
            <span className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground">詳しさ:</span>
              {MEANING_LEVELS.map((lv) => {
                const active = meaningLevel === lv
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={(e) => { e.preventDefault(); setMeaningLevel(lv) }}
                    disabled={submitting}
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
            </span>
          )}
        </span>
      </label>

      {/* タグの自動生成 */}
      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={generateTags}
          onChange={(e) => setGenerateTags(e.target.checked)}
          disabled={submitting}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">各カードのタグをAIで自動生成する</span>
          <span className="block text-xs text-muted-foreground">
            作成するすべてのカードについて、分類タグをAIで生成します。手入力したタグがあれば、それに追加されます。
          </span>
        </span>
      </label>

      {/* デッキへの追加 */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <Label>デッキ（任意）</Label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-input"
            checked={createNewDeck}
            onChange={(e) => setCreateNewDeck(e.target.checked)}
            disabled={submitting}
          />
          <span className="flex-1 space-y-2">
            <span className="block text-sm font-medium">今回のカードで新しいデッキを作成する</span>
            {createNewDeck && (
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                disabled={submitting}
                placeholder={`デッキ名（未入力なら「デッキ ${deckViews.length + 1}」）`}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </span>
        </label>

        {deckViews.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <span className="block text-sm font-medium">既存のデッキに追加する</span>
            <div className="flex flex-wrap gap-2">
              {deckViews.map((view) => {
                const active = selectedDeckIds.includes(view.id)
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => toggleDeck(view.id)}
                    disabled={submitting}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                      active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                  >
                    {view.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {apiError && <p className="text-sm text-destructive">{apiError}</p>}

      {progress && (
        <p className="text-sm text-muted-foreground">
          作成中... {progress.done} / {progress.total}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting || wordCount === 0 || hasTooLongTitle}
        className="w-full flex items-center justify-center gap-2"
      >
        {submitting && <Spinner size={15} />}
        {submitting
          ? `作成中... (${progress?.done ?? 0}/${progress?.total ?? wordCount})`
          : wordCount > 1
            ? `${wordCount}件のカードを作成`
            : 'カードを作成'}
      </Button>
    </form>
  )
}
