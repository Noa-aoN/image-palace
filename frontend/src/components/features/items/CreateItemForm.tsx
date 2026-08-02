'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, ListChecks } from 'lucide-react'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { getWordlists } from '@/lib/api/wordlists'
import type { View } from '@/types/view'
import type { Wordlist } from '@/types/wordlist'
import { ASPECT_RATIOS, ASPECT_RATIO_KEYS, type AspectRatioKey } from '@/lib/aspect-ratio'

const MAX_TITLE_LENGTH = 100
const WORDLIST_SECTION = 'card-create-wordlist'

/**
 * 入力を 1 枚ずつの言葉に切り分ける。
 *
 * 基本は改行のみ。カンマや読点は言葉の中に現れるため、既定で区切りにすると
 * 「Hello, world」「1,000」「彼は、走った」が意図せず分かれてしまう。
 * タブは表計算から貼ったときの列区切りで、言葉の中には現れないので常に区切る。
 *
 * カンマ・読点で区切りたい場合は splitByPunctuation を立てる（フォーム側の任意設定）。
 * 全角カンマも対象に含める（半角だけだと日本語入力で取りこぼす）。
 */
function parseTitles(raw: string, splitByPunctuation = false): string[] {
  const pattern = splitByPunctuation ? /[\n\t,，、]/ : /[\n\t]/
  return raw
    .split(pattern)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * カード作成フォーム。
 *
 * inPanel: 右パネルに差し込んで使う場合。作成後に一覧へ遷移せず、
 * 入力だけ空にして開いたままにする（続けて作れるようにするため）。
 */
export function CreateItemForm({ inPanel = false }: { inPanel?: boolean } = {}) {
  const router = useRouter()
  // ワードリスト詳細から「?wordlist=<id>」で来た場合、その単語を入力欄へ初期投入する
  const prefillWordlistId = useSearchParams().get('wordlist')
  const upsertItem = useItemsStore((state) => state.upsertItem)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)
  const [input, setInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [style, setStyle] = useState('')
  // 画像の縦横比。未選択なら保存側でユーザー既定が使われる
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey | ''>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [forceGenerate, setForceGenerate] = useState(false)
  // タグ生成・説明生成は既定ON（ユーザー設定があればそれで上書き）
  const [generateMeaning, setGenerateMeaning] = useState(true)
  const [meaningLevel, setMeaningLevel] = useState<string>(DEFAULT_MEANING_LEVEL)
  const [generateTags, setGenerateTags] = useState(true)
  const [deckViews, setDeckViews] = useState<View[]>([])
  const [wordlists, setWordlists] = useState<Wordlist[]>([])
  const [createNewDeck, setCreateNewDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [apiError, setApiError] = useState<string | null>(null)
  // 生成オプションは既定で閉じる。作るだけなら触らずに済むため。
  // 開けるのは 1 グループずつ（同時に開くと縦に伸びて入力欄から遠くなる）
  const [openGroup, setOpenGroup] = useState<'image' | 'enrich' | 'place' | null>(null)
  const [showWordlists, setShowWordlists] = useState(false)
  const openSection = useRightPanelStore((st) => st.openSection)
  const closePanel = useRightPanelStore((st) => st.close)
  const openWordlistPanel = () =>
    openSection({ key: WORDLIST_SECTION, title: 'ワードリストから挿入' })
  // カンマ・読点での分割は既定オフ。言葉の中に現れる記号なので誤って分かれるため
  const [splitByPunctuation, setSplitByPunctuation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // 既存デッキ一覧と、意味自動生成のデフォルト値（ユーザー設定）を読み込む
  useEffect(() => {
    getViews().then((vs) => setDeckViews(vs.filter((v) => v.view_type === 'deck'))).catch(() => {})
    getWordlists()
      .then((lists) => {
        setWordlists(lists)
        // 指定ワードリストがあり、入力欄がまだ空なら、その単語を初期投入する
        if (prefillWordlistId) {
          const wl = lists.find((w) => w.id === prefillWordlistId)
          if (wl && wl.words.length > 0) {
            setInput((prev) => (prev.trim() ? prev : wl.words.join('\n')))
          }
        }
      })
      .catch(() => {})
    getSettings()
      .then((s) => {
        setGenerateMeaning(s.auto_generate_meanings)
        setGenerateTags(s.auto_generate_tags)
      })
      .catch(() => {})
    fetchBilling()
  }, [fetchBilling, prefillWordlistId])

  const toggleDeck = (id: string) => {
    setSelectedDeckIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  const titles = parseTitles(input, splitByPunctuation)
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
      // 送信先デッキ（view_type='deck' のキャンバス）を組み立てる。新規作成する場合は先に作る
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
          aspectRatio: aspectRatio || undefined,
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
      if (inPanel) {
        // パネルでは元の画面を離れない。続けて作れるよう入力だけ空にする
        setInput('')
      } else {
        router.push('/items')
      }
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

  // 選択したワードリストの単語を入力欄に追記する（既存の入力は残す）。
  const insertWordlist = (wordlist: Wordlist) => {
    if (wordlist.words.length === 0) return
    setInput((prev) => {
      const existing = prev.trim()
      const added = wordlist.words.join('\n')
      return existing ? `${existing}\n${added}` : added
    })
  }

  // 閉じていても何が効くのかが分かるよう、グループごとに選んだものを示す
  const join = (parts: (string | false | '')[]) => parts.filter(Boolean).join(' / ')
  const optionSummary = {
    image: join([customPrompt.trim() && '追加指示', style && 'スタイル', aspectRatio && '形']),
    enrich: join([generateMeaning && '意味', generateTags && 'タグ']),
    place: join([(createNewDeck || selectedDeckIds.length > 0) && 'デッキ']),
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="titles" required className="text-base">
            カードにする言葉
          </Label>
          {remainingCards !== null && (
            <span className="text-xs text-muted-foreground">あと約{remainingCards}枚作成できます</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          例: <span className="font-medium text-foreground">パルテノン神殿 / API / 光合成 / 細胞分裂</span> …
        </p>
        {/*
          ワードリストからの挿入。選択肢が名前と語数の 2 情報を持つため、
          ドロップダウンではなく一覧で見せる。

          置き場所はフォームがどこにあるかで変える。
          ページ上ならライトパネルへ出す（入力欄を狭めずに一覧を広く見せられる）。
          フォーム自体がパネルに入っているときは、別セクションへ切り替えると
          入力途中の内容が失われるため、その場で開く。
        */}
        {wordlists.length > 0 && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (inPanel ? setShowWordlists((v) => !v) : openWordlistPanel())}
              aria-expanded={inPanel ? showWordlists : undefined}
              disabled={submitting}
              className="flex items-center gap-1.5"
            >
              <ListChecks size={15} />
              ワードリストから挿入
              <ChevronRight size={15} className={`transition-transform ${showWordlists ? 'rotate-90' : ''}`} />
            </Button>
            {inPanel && showWordlists && (
              <WordlistPicker
                wordlists={wordlists}
                disabled={submitting}
                onPick={(wl) => {
                  insertWordlist(wl)
                  setShowWordlists(false)
                }}
              />
            )}
            {!inPanel && (
              <PanelSlotContent sectionKey={WORDLIST_SECTION}>
                <WordlistPicker
                  wordlists={wordlists}
                  disabled={submitting}
                  onPick={(wl) => {
                    insertWordlist(wl)
                    closePanel()
                  }}
                />
              </PanelSlotContent>
            )}
          </div>
        )}
        <textarea
          id="titles"
          className="w-full min-h-[180px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          placeholder={'パルテノン神殿\nAPI\n光合成\n︙'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            1 行につき 1 枚。改行で区切ってまとめて作成できます。
            {wordCount > 0 && <span className="ml-1 font-medium text-foreground">{wordCount}件を認識</span>}
          </p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={splitByPunctuation}
              onChange={(e) => setSplitByPunctuation(e.target.checked)}
              disabled={submitting}
              className="h-3.5 w-3.5 rounded border-input"
            />
            カンマ・読点でも区切る（「Hello, world」のように語の中に含む場合は外してください）
          </label>
        </div>
        {hasTooLongTitle && (
          <p className="text-xs text-destructive">
            1単語あたり{MAX_TITLE_LENGTH}文字を超えています。区切り直すか短くしてください。
          </p>
        )}
        {willExceedCredits && (
          <p className="text-xs text-destructive">
            クレジットが不足します（残り約{remainingCards}枚 / 入力{wordCount}件）。
            <Link href="/billing" className="ml-1 underline">プランを見る</Link>
          </p>
        )}
      </div>

      {/*
        生成オプション。似たものだけをまとめ、グループごとに畳む。
        既定は閉じておく。入力して作るだけなら触らずに済み、こだわるときだけ開けばよい。
      */}
      <div className="space-y-2">
        <p className="text-base font-medium">オプション（任意）</p>
        <OptionGroup
          label="画像の作り方"
          summary={optionSummary.image}
          open={openGroup === 'image'}
          onToggle={() => setOpenGroup((cur) => (cur === 'image' ? null : 'image'))}
        >
      {/* 追加の指示（自由入力） */}
      <div className="space-y-2">
        <Label htmlFor="custom-prompt">追加の指示</Label>
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
      {/* スタイル（プリセット） */}
      <div className="space-y-2">
        <Label>スタイル</Label>
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
      {/* 画像の形（縦横比）。生成・保存・表示に共通で効く */}
      <div className="space-y-2">
        <Label>画像の形</Label>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIO_KEYS.map((key) => {
            const opt = ASPECT_RATIOS[key]
            const active = aspectRatio === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAspectRatio(active ? '' : key)}
                disabled={submitting}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                  active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={active ? { backgroundColor: 'var(--palace)' } : undefined}
              >
                {/* 比そのものを小さな枠で見せる（言葉より形の方が早い） */}
                <span
                  aria-hidden
                  className="w-3 shrink-0 rounded-[2px] border border-current opacity-70"
                  style={{ aspectRatio: opt.css }}
                />
                {opt.label}
                {opt.note && <span className="text-[10px] opacity-70">（{opt.note}）</span>}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          未選択なら設定の既定を使います。比率ごとに別の画像として生成されます。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">タグ</Label>
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
        </OptionGroup>
        <OptionGroup
          label="自動で足す情報"
          summary={optionSummary.enrich}
          open={openGroup === 'enrich'}
          onToggle={() => setOpenGroup((cur) => (cur === 'enrich' ? null : 'enrich'))}
        >
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
        </OptionGroup>
        <OptionGroup
          label="保存する場所"
          summary={optionSummary.place}
          open={openGroup === 'place'}
          onToggle={() => setOpenGroup((cur) => (cur === 'place' ? null : 'place'))}
        >
      {/* デッキへの追加 */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <Label>デッキ</Label>

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
        </OptionGroup>
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

/**
 * 生成オプションの 1 グループ。似た設定だけをまとめて畳む。
 * 閉じていても何が効いているか分かるよう、選んだ項目名を見出しの右に出す。
 */
function OptionGroup({
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  label: string
  summary: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium">{label}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {summary}
          <ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </span>
      </button>
      {open && <div className="space-y-5 border-t border-border/70 px-4 py-4">{children}</div>}
    </div>
  )
}

/** ワードリストの一覧。名前と語数を並べて出し、選ぶと呼び出し側へ渡す */
function WordlistPicker({
  wordlists,
  disabled,
  onPick,
}: {
  wordlists: Wordlist[]
  disabled?: boolean
  onPick: (wordlist: Wordlist) => void
}) {
  return (
    <div className="grid gap-1.5 rounded-xl border border-border/70 p-2 sm:grid-cols-2">
      {wordlists.map((wl) => (
        <button
          key={wl.id}
          type="button"
          onClick={() => onPick(wl)}
          disabled={disabled}
          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
        >
          <span className="truncate">{wl.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{wl.word_count}語</span>
        </button>
      ))}
    </div>
  )
}
