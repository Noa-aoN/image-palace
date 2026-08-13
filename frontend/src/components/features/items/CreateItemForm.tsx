'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { ChevronRight, Eraser, ListChecks, Sparkles } from 'lucide-react'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useSettingsStore } from '@/stores/settings'
import { useAcropolisStore } from '@/stores/acropolis'
import { normalizeWordDifficulty } from '@/lib/word-difficulty'
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
import {
  STYLE_OPTIONS,
  FRAMING_OPTIONS,
  PROMPT_SOURCE_OPTIONS,
  DEFAULT_PROMPT_SOURCE,
  CUSTOM_PROMPT_MAX_LENGTH,
} from '@/lib/item-styles'
import { ImageModelPicker } from '@/components/features/items/ImageModelPicker'
import { MEANING_LEVELS, meaningLevelLabel, DEFAULT_MEANING_LEVEL } from '@/lib/meaning-levels'
import { getWordlists, generateWords } from '@/lib/api/wordlists'
import type { View } from '@/types/view'
import type { Wordlist } from '@/types/wordlist'
import { ASPECT_RATIOS, ASPECT_RATIO_KEYS, type AspectRatioKey } from '@/lib/aspect-ratio'
import { HelpPopover } from '@/components/ui/help-popover'

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
/**
 * 作成時に一緒に埋められる項目。
 *
 * サーバー側の許可一覧（Items::EnsurePropertyDefinitions::PRESETS）と揃える。
 * ここに無いものは作らない。押した時点で、その項目の置き場所も用意される。
 */
const PROPERTY_OPTIONS = [
  {
    key: 'reading',
    label: '読み仮名',
    what: 'その語の読みを入れます。複数の読みがあれば全部。',
    when: '読めない漢字・専門用語を覚えるときに効きます。',
  },
  {
    key: 'aliases',
    label: '別名・異表記',
    what: '同じものを指す別の呼び名や書き方を入れます。',
    when: '略称や旧称があるもの、表記が揺れるものに。',
  },
  {
    key: 'pronunciation',
    label: '発音記号',
    what: '発音記号（IPA など）を入れます。',
    when: '外国語の単語に。日本語の語では埋まらないことがあります。',
  },
] as const

export function CreateItemForm({
  inPanel = false,
  wordlistId,
}: { inPanel?: boolean; wordlistId?: string } = {}) {
  const router = useRouter()
  // ワードリスト詳細から「?wordlist=<id>」で来た場合、その単語を入力欄へ初期投入する
  // ワードリストからの持ち込み。呼び出し側（ページ／パネル）が値を渡す
  const prefillWordlistId = wordlistId
  const upsertItem = useItemsStore((state) => state.upsertItem)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)
  const [input, setInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [style, setStyle] = useState('')
  const [framing, setFraming] = useState('')
  const [imageModel, setImageModel] = useState('')
  const [promptSource, setPromptSource] = useState(DEFAULT_PROMPT_SOURCE)
  // 画像の縦横比。未選択なら保存側でユーザー既定が使われる
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey | ''>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [forceGenerate, setForceGenerate] = useState(false)
  // タグ生成・説明生成は既定ON（ユーザー設定があればそれで上書き）
  const [generateMeaning, setGenerateMeaning] = useState(true)
  const [meaningLevel, setMeaningLevel] = useState<string>(DEFAULT_MEANING_LEVEL)
  const [generateTags, setGenerateTags] = useState(true)
  // 項目（読み仮名・別名・発音記号）の自動生成。選んだぶんを1回でまとめて埋める。
  // 既定は空（AI の呼び出しが1回増えるので、明示的に選んでもらう）
  const [propertyKeys, setPropertyKeys] = useState<string[]>([])

  const togglePropertyKey = (key: string, on: boolean) =>
    setPropertyKeys((prev) => (on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)))

  /**
   * 「できる限り」は、いま全部入っているかを映す鏡。
   *
   * 押すと全部入り、もう一度押すと全部外れる。1つでも外せば、ここの印も外れる。
   * こうしておくと「全部にしたのに一部が作られない」が起こらない。
   */
  const allEnrichOn =
    generateMeaning && generateTags && PROPERTY_OPTIONS.every((o) => propertyKeys.includes(o.key))

  const toggleAllEnrich = (on: boolean) => {
    setGenerateMeaning(on)
    setGenerateTags(on)
    setPropertyKeys(on ? PROPERTY_OPTIONS.map((o) => o.key) : [])
  }
  const [deckViews, setDeckViews] = useState<View[]>([])
  const [wordlists, setWordlists] = useState<Wordlist[]>([])
  const [createNewDeck, setCreateNewDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [apiError, setApiError] = useState<string | null>(null)
  // 生成オプションは既定で閉じる。作るだけなら触らずに済むため。
  // 開けるのは 1 グループずつ（同時に開くと縦に伸びて入力欄から遠くなる）
  const [openGroup, setOpenGroup] = useState<'image' | 'enrich' | 'organize' | 'place' | null>(null)
  const [showWordlists, setShowWordlists] = useState(false)
  const wordlistBoxRef = useRef<HTMLDivElement>(null)
  // 一覧を開いたまま他を触ったら畳む。開きっぱなしだと入力欄が押し下げられる
  useEffect(() => {
    if (!showWordlists) return

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-wordlist-toggle]')) return
      if (!wordlistBoxRef.current?.contains(target)) setShowWordlists(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showWordlists])

  // クリアは押し間違いで入力が消えるため 2 段階にする
  const [confirmClear, setConfirmClear] = useState(false)
  const [consulting, setConsulting] = useState(false)
  const [oracleError, setOracleError] = useState<string | null>(null)
  const settings = useSettingsStore((st) => st.settings)
  // アクロポリスと同じ履歴を見る。受け取り済みは出さず、キャンセル済みは出にくくする
  const acropolisHistory = useAcropolisStore((st) => st.history)
  const oracleExclude = useMemo(
    () =>
      Array.from(
        new Set(acropolisHistory.filter((r) => r.status === 'received').flatMap((r) => r.words))
      ),
    [acropolisHistory]
  )
  const oracleAvoid = useMemo(
    () =>
      Array.from(
        new Set(acropolisHistory.filter((r) => r.status === 'cancelled').flatMap((r) => r.words))
      ),
    [acropolisHistory]
  )

  /*
    デルフォイ挿入。神託から単語をひとつ受け取り、入力欄の末尾へ足す。
    ここで作るのは単語だけで、クレジットは消費しない（消費はカードを作る段階）。

    出す語の選び方はアクロポリスと揃える。あちらだけ賢いと、同じ「神託」なのに
    こちらでは同じような語ばかり出る、という食い違いが起きるため。
      ・入力済みの語と、アクロポリスで受け取り済みの語は出さない
      ・キャンセルした語は出にくくする
      ・難しさは環境設定の既定に従う
    ジャンルや枚数は指定できるようにしない。細かく選びたいときはアクロポリスへ行けばよく、
    ここは入力を一語足すだけの補助に留める。
    アクロポリスの履歴には残さない（あちらは神託を受けて受け取る一連の流れで、
    こちらは入力補助。混ぜると両方の意味が濁る）。
  */
  const consultOracle = async () => {
    if (consulting || submitting) return
    setConsulting(true)
    setOracleError(null)
    try {
      const existing = parseTitles(input, splitByPunctuation)
      const words = await generateWords('', 1, {
        exclude: [...existing, ...oracleExclude],
        avoid: oracleAvoid,
        difficulty: normalizeWordDifficulty(settings?.word_difficulty),
      })
      const word = words[0]?.trim()
      if (!word) {
        setOracleError('神託が得られませんでした。もう一度お試しください。')
        return
      }
      setInput((current) => (current.trim() ? `${current.replace(/\s*$/, '')}\n${word}` : word))
    } catch {
      setOracleError('神託に失敗しました。もう一度お試しください。')
    } finally {
      setConsulting(false)
    }
  }
  const openSection = useRightPanelStore((st) => st.openSection)
  const closePanel = useRightPanelStore((st) => st.close)
  const openWordlistPanel = () =>
    openSection({ key: WORDLIST_SECTION, title: 'ワードリスト', href: '/wordlists' })
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
          framing: framing || undefined,
          imageModel: imageModel || undefined,
          promptSource,
          aspectRatio: aspectRatio || undefined,
          customPrompt: customPrompt.trim() || undefined,
          generateMeaning,
          generateMeaningLevel: generateMeaning ? meaningLevel : undefined,
          generateTags,
          generateProperties: propertyKeys.length > 0,
          generatePropertyKeys: propertyKeys,
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
    image: join([
      promptSource !== DEFAULT_PROMPT_SOURCE && '指示の作り方',
      customPrompt.trim() && '追加指示',
      style && 'スタイル',
      framing && '構図',
      aspectRatio && '形',
    ]),
    enrich: join([
      generateMeaning && '意味',
      propertyKeys.length > 0 && `項目${propertyKeys.length}件`,
      generateTags && 'タグ',
    ]),
    organize: join([tagNames.length > 0 && `タグ${tagNames.length}件`]),
    place: join([(createNewDeck || selectedDeckIds.length > 0) && 'デッキ']),
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        {/* パネルの幅では横に並べると窮屈なので、残枚数は次の行へ落とす */}
        <div
          className={
            inPanel
              ? 'flex flex-col items-start gap-1'
              : 'flex items-center justify-between gap-2'
          }
        >
          <Label htmlFor="titles" required className="text-base">
            カードにする言葉
          </Label>
          {remainingCards !== null && (
            <span className="text-xs text-muted-foreground">あと約{remainingCards}枚作成できます</span>
          )}
        </div>
        {/*
          ワードリストからの挿入。選択肢が名前と語数の 2 情報を持つため、
          ドロップダウンではなく一覧で見せる。

          置き場所はフォームがどこにあるかで変える。
          ページ上ならライトパネルへ出す（入力欄を狭めずに一覧を広く見せられる）。
          フォーム自体がパネルに入っているときは、別セクションへ切り替えると
          入力途中の内容が失われるため、その場で開く。
        */}
        <div className="flex flex-wrap items-center gap-2">
          {wordlists.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-wordlist-toggle
              onClick={() => (inPanel ? setShowWordlists((v) => !v) : openWordlistPanel())}
              aria-expanded={inPanel ? showWordlists : undefined}
              disabled={submitting}
              title="保存したワードリストから単語をまとめて入れる"
              className="flex items-center gap-1.5"
            >
              <ListChecks size={15} />
              ワードリスト
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={consultOracle}
            disabled={submitting || consulting}
            title="デルフォイの神託から単語をひとつ受け取る"
            className="flex items-center gap-1.5"
          >
            {consulting ? <Spinner size={15} /> : <Sparkles size={15} />}
            デルフォイ
          </Button>
          {/*
            クリアは常に置く。入力の有無で現れたり消えたりすると、隣のボタンの位置が動く。
            押し間違いで入力が消えないよう 2 段階にするが、確認中も文字は足さない
            （足すと狭いパネルで折り返し、入力欄まで遠くなる）。色と説明で示す。

            置き場所は右端へ離す。単語を入れる 2 つと等間隔で並ぶと、
            消す操作が同じ性格のものに見えて押し間違えやすい。
          */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true)
                return
              }
              setInput('')
              setConfirmClear(false)
            }}
            onBlur={() => setConfirmClear(false)}
            disabled={submitting || input.trim().length === 0}
            aria-label={confirmClear ? 'もう一度押すと入力した言葉を消す' : '入力した言葉を消す'}
            title={confirmClear ? 'もう一度押すと消えます' : '入力した言葉を消す'}
            className={`ml-auto flex items-center ${confirmClear ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            <Eraser size={15} />
          </Button>
        </div>

        {wordlists.length > 0 && (
          <div ref={wordlistBoxRef} className="space-y-2">
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
          placeholder={'例）パルテノン神殿\nAPI\n光合成\n︙'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        {oracleError && <p className="text-xs text-destructive">{oracleError}</p>}

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
      {/*
        画像への指示をどう作るか。3つは「単語をどれだけ噛み砕いてから絵にするか」の段階で、
        噛み砕くほど絵は的確になり、そのぶん遅く・高くなる。

        既定（単語から情景を起こす）を動かさないのは、指示が単語だけで決まるおかげで
        同じ単語の画像を全ユーザーで使い回せているため。ここを外すとその共有が効かなくなる。
      */}
      <div className="space-y-2">
        <Label>画像への指示の作り方</Label>
        <p className="text-xs text-muted-foreground">単語をどこまで噛み砕いてから絵にするか。</p>
        <div className="flex flex-wrap gap-2">
          {PROMPT_SOURCE_OPTIONS.map((opt) => {
            const active = promptSource === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPromptSource(opt.value)}
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
        <p className="text-xs text-muted-foreground">
          {PROMPT_SOURCE_OPTIONS.find((opt) => opt.value === promptSource)?.note}
        </p>
        {promptSource === 'research' && (
          <p className="text-xs text-muted-foreground">
            意味・説明も必ず作られます。指示がカードごとに変わるため同じ単語の画像を使い回せなくなり、
            <strong>生成コストが上がります</strong>。
          </p>
        )}
      </div>
      {/* 追加の指示（自由入力） */}
      <div className="space-y-2">
        <Label htmlFor="custom-prompt">追加の指示</Label>
        <p className="text-xs text-muted-foreground">絵の中身への注文。「夜明けの光で」「人物を入れずに」など。</p>
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
        <p className="text-xs text-muted-foreground">絵のタッチ。油彩・線画など、全体の描き方を選びます。</p>
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
      {/* 構図。人物は「単体」、概念は「情景」が向く。おまかせは従来どおり */}
      <div className="space-y-2">
        <Label>構図</Label>
        <p className="text-xs text-muted-foreground">被写体をどう写すか。人物の肖像が欲しいときは「単体」を選びます。</p>
        <div className="flex flex-wrap gap-2">
          {FRAMING_OPTIONS.map((opt) => {
            const active = framing === opt.value
            return (
              <button
                key={opt.value || 'default'}
                type="button"
                onClick={() => setFraming(opt.value)}
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
        <p className="text-xs text-muted-foreground">
          {FRAMING_OPTIONS.find((opt) => opt.value === framing)?.note}
        </p>
      </div>
      {/* 絵を作るモデル。選べるものが1つしかないときは出ない */}
      <ImageModelPicker value={imageModel} onChange={setImageModel} disabled={submitting} />

      {/* 画像の形（縦横比）。生成・保存・表示に共通で効く */}
      <div className="space-y-2">
        <Label>画像の形</Label>
        <p className="text-xs text-muted-foreground">縦横比。あとから変えられないので、作る前に選びます。</p>
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
      {/*
        いちばん上に「まとめて」を置く。ここだけ押せば決まるようにして、
        こだわる人が下で外せる形にする。
        説明はぜんぶ ? へ逃がす。1行ずつ本文を付けると、項目が増えるほど縦に伸びる
      */}
      <label className="flex items-start gap-3 rounded-xl border border-[var(--palace)]/40 bg-[var(--palace)]/5 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={allEnrichOn}
          onChange={(e) => toggleAllEnrich(e.target.checked)}
          disabled={submitting}
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            できる限り自動で生成する
            <HelpPopover label="できる限り自動で生成するについて" title="できる限り自動で生成する">
              <div className="space-y-2 text-sm">
                <p>意味・説明、読み仮名・別名・発音記号、タグをまとめて作ります。</p>
                <p>入れたあとで、下の一つずつを外せます。もう一度ここを押すと、また全部が入ります。</p>
                <p className="text-muted-foreground">
                  画像の作り方や画質など、費用の大きいものはここには入りません。
                </p>
              </div>
            </HelpPopover>
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
          <span className="flex items-center gap-1.5 text-sm font-medium">
            意味・説明
            <HelpPopover label="意味・説明について" title="意味・説明">
              <div className="space-y-2 text-sm">
                <p>その語が何かを、AI が短くまとめます。</p>
                <p>あとから直せます。手で書いたものは上書きされません。</p>
                <p className="text-muted-foreground">1枚につき AI の呼び出しが1回。</p>
              </div>
            </HelpPopover>
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
      {/* 項目（読み仮名・別名・発音記号）。**選んだぶんを1回でまとめて埋める** */}
      {PROPERTY_OPTIONS.map((option) => (
        <label
          key={option.key}
          className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3"
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-input"
            checked={propertyKeys.includes(option.key)}
            onChange={(e) => togglePropertyKey(option.key, e.target.checked)}
            disabled={submitting}
          />
          <span className="flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {option.label}
              <HelpPopover label={`${option.label}について`} title={option.label}>
                <div className="space-y-2 text-sm">
                  <p>{option.what}</p>
                  <p>{option.when}</p>
                  <p className="text-muted-foreground">
                    選んだ項目はまとめて1回で埋めます。いくつ選んでも AI の呼び出しは1回のまま。
                    空いているところだけを埋めるので、手で書いたものは上書きされません。
                  </p>
                </div>
              </HelpPopover>
            </span>
          </span>
        </label>
      ))}

      {/* タグの自動生成 */}
      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={generateTags}
          onChange={(e) => setGenerateTags(e.target.checked)}
          disabled={submitting}
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            タグ
            <HelpPopover label="タグについて" title="タグ">
              <div className="space-y-2 text-sm">
                <p>分類のタグを AI が付けます。</p>
                <p>下の「整理」で手入力したタグがあれば、それに足す形になります。</p>
                <p className="text-muted-foreground">1枚につき AI の呼び出しが1回。</p>
              </div>
            </HelpPopover>
          </span>
        </span>
      </label>
        </OptionGroup>
        <OptionGroup
          label="整理"
          summary={optionSummary.organize}
          open={openGroup === 'organize'}
          onToggle={() => setOpenGroup((cur) => (cur === 'organize' ? null : 'organize'))}
        >
      {/* 手で付けるタグ。**絵の話ではなく、カードを分けるための話**なので、
          画像の作り方から出してここに置く */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-background px-4 py-3">
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
      {open && (
        <div
          className="divide-y divide-border/60 border-t border-border/70 px-4
            [&>*]:py-4 [&>*:first-child]:pt-3 [&>*:last-child]:pb-3
            [&_[data-slot=label]]:text-xs [&_[data-slot=label]]:text-muted-foreground"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * ワードリストの一覧。名前と語数を並べて出し、選ぶと呼び出し側へ渡す。
 *
 * 件数は際限なく増えうる（API はページングしない）。全部並べると目で探せなくなるので、
 * 数が増えたときだけ絞り込みを出し、高さも抑えてスクロールに収める。
 */
function WordlistPicker({
  wordlists,
  disabled,
  columns = 1,
  onPick,
}: {
  wordlists: Wordlist[]
  disabled?: boolean
  /** 1 列で縦に並べるか。パネルのような狭い幅では 1 列にして名前を読めるようにする */
  columns?: 1 | 2
  onPick: (wordlist: Wordlist) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? wordlists.filter((wl) => wl.name.toLowerCase().includes(q)) : wordlists

  return (
    <div className="space-y-2 rounded-xl border border-border/70 p-2">
      <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`名前で絞り込む（${wordlists.length}件）`}
          disabled={disabled}
          aria-label="ワードリストを名前で絞り込む"
          className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {shown.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">一致するワードリストがありません。</p>
      ) : (
        <div className={`grid max-h-72 gap-1.5 overflow-y-auto ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
          {shown.map((wl) => (
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
      )}
    </div>
  )
}
