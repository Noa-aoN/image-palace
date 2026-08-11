'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Sparkles, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBillingStore } from '@/stores/billing'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { previewBrief, retryItem, rewriteScenePrompt, updateItem, type SceneOption } from '@/lib/api/items'
import { ImageModelPicker } from '@/components/features/items/ImageModelPicker'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { getSettings } from '@/lib/api/settings'
import { STYLE_OPTIONS, FRAMING_OPTIONS, CUSTOM_PROMPT_MAX_LENGTH } from '@/lib/item-styles'
import type { Item } from '@/types/item'

interface Props {
  item: Item
  onUpdated: (item: Item) => void
}

const PANEL_KEY = 'item-regenerate'

/**
 * カードの画像を作り直す。failed・completed どちらの状態からも使える。
 *
 * ページに置くのはボタン1つだけにして、中身は右パネルで開く。
 * 画像そのものを見る面積を、設定のために削らないため。
 *
 * ここで**画像への指示を直接直せる**ようにしてある。
 * 思った絵にならないとき、いちばん効くのがそこだから。
 * 直してから作り直すまでを1回の操作で終える。
 *
 * 手で書くのが難しいときのために「意味・説明から書き直す」を置く。
 * 説明文を指示の末尾に足す（＝旧「意味・説明を参考にする」）やり方は、
 * 指示がある状態では効かなかった。指示は既に視覚の言葉へ翻訳された完成品で、
 * そこへ人向けの日本語を足しても絵に届かないため。足すのではなく書き直す。
 * 書き直した文はこの入力欄に入るだけで、まだ作り直しは始まらない。
 * クレジットを使う前に、何がどう変わるのかを読んで決められるようにする。
 *
 * もとにする説明文はここには写さない。カード詳細に出ているものの二重表示になるうえ、
 * 画像を見る面積を設定で削ることになる。どの意味で書き直したかは候補の見出しで分かる。
 * 絵がまるで変わるほど意味・ジャンルが分かれる語では候補が複数返るので、ここで選んでもらう。
 *
 * 出来上がったものの作り直しは、新しい画像を1枚作るので1クレジット使う。
 * 失敗からの作り直しは無料（渡せていないものに課金しない）。
 */
export function RegeneratePanel({ item, onUpdated }: Props) {
  const isFailed = item.generation_status === 'failed'
  const panel = usePanelForm(PANEL_KEY, 'イメージ再生成')
  const [scenePrompt, setScenePrompt] = useState(item.scene_prompt ?? '')
  const [customPrompt, setCustomPrompt] = useState(item.custom_prompt ?? '')
  const [style, setStyle] = useState(item.style ?? '')
  const [framing, setFraming] = useState(item.framing ?? '')
  const [useMeaning, setUseMeaning] = useState(false)
  const [imageModel, setImageModel] = useState(item.image_model ?? '')
  const [retrying, setRetrying] = useState(false)
  // どちらの書き直しが走っているか（null なら止まっている）
  const [rewriting, setRewriting] = useState<'title' | 'meaning' | 'property' | null>(null)
  // 根拠にする項目。意味・説明だけが手がかりとは限らない
  // （Wikipedia の冒頭や自分のメモのほうが絵になることがある）
  const [pickingProperties, setPickingProperties] = useState(false)
  const [selectedProperties, setSelectedProperties] = useState<string[]>([])
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  // 書き直す前の指示。置き換えは一瞬で終わるが、手で書いたものが消えるので戻せるようにする
  const [beforeRewrite, setBeforeRewrite] = useState<string | null>(null)
  // 意味・ジャンルが分かれる語で返る候補。1件だけならそのまま入れるので、ここには残らない
  const [sceneOptions, setSceneOptions] = useState<SceneOption[]>([])
  // 書き直しの根拠になった説明文。作り直しのときに指示と一緒に保存する
  const [pendingDescription, setPendingDescription] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const available = useBillingStore((s) => s.summary?.available_credits) ?? null
  // 失敗からの作り直しは無料。出来上がったものの作り直しだけ1クレジット
  const costsCredit = !isFailed
  // 入力を変えないかぎり同じ結果になる失敗（方針違反・入力から絵を決められない）。
  // 押しても必ず失敗するので、そのままでは進ませない
  const inputBound = isFailed && item.generation_retryable === false
  // 何かを直したか。直せば別の注文になるので、そこで初めて進める
  const edited =
    scenePrompt !== (item.scene_prompt ?? '') ||
    customPrompt !== (item.custom_prompt ?? '') ||
    style !== (item.style ?? '') ||
    framing !== (item.framing ?? '') ||
    imageModel !== (item.image_model ?? '')
  const blocked = inputBound && !edited
  const insufficient = costsCredit && available !== null && available < 1
  // 「意味・説明を参考にする」の初期値はユーザー設定（既定 OFF）に従う。ユーザーが触ったら以後は上書きしない。
  const meaningTouched = useRef(false)

  const hasMeaning = Boolean(item.meaning && item.meaning.trim())
  // 「意味・説明を参考にする」（＝説明文を指示の末尾に足す）が実際に効くのは、
  // 指示が空＝単語をそのまま被写体にするときだけ。指示があるときは、それが既に
  // 視覚の言葉へ翻訳された完成品なので、末尾に日本語の説明文を足しても絵に効かない。
  // 効かない選択肢を置いておくと「チェックしたのに変わらない」になるので、出さない。
  // 指示があるカードで意味を効かせたいときは「意味・説明から書き直す」を使う。
  const showMeaningOption = hasMeaning && !scenePrompt.trim()

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (!meaningTouched.current) setUseMeaning(s.regenerate_with_meaning)
      })
      .catch(() => {})
  }, [])

  // 書き直した指示を入力欄に入れる。まだ保存も作り直しもしない。
  // 「書き直す」なので既存の指示は置き換わる。足したままでは効かないのが今回の主旨だから。
  // ただし手で書いたものが一発で消えるので、直前の内容を控えて戻せるようにする。
  // 書き直した指示を入力欄へ。
  //
  // 説明文（description）も一緒に預かる。作り直しのときに指示と並べて保存し、
  // 「プロンプト情報」の説明文と情景が同じ出どころになるようにする。
  // 片方だけ新しいと、絵を見て「なぜこうなったか」を辿れなくなる。
  const applyScene = (next: string, description?: string | null) => {
    setBeforeRewrite(scenePrompt)
    setScenePrompt(next)
    setSceneOptions([])
    if (description) setPendingDescription(description)
  }

  // AI に指示を書き直させる。もとにするものが2つある。
  //   title   … 単語だけから（全ユーザー共有の下ごしらえ。以前「プロンプト情報」にあったもの）
  //   meaning … このカードの意味・説明から（カード固有）
  // どちらも保存はしない。1 クレジット使う前に、何がどう変わるのかを読んで決められるようにする。
  //
  // meaning のほうは、絵がまるで変わるほど意味・ジャンルが分かれる語（アポロ＝神／宇宙計画 など）で
  // 候補が複数返る。どちらの絵が欲しいかは説明文からは決まらないので、黙って選ばず選んでもらう。
  // 中身のある項目だけを選ばせる。空の項目を選んでも書き直せない
  const filledProperties = (item.properties ?? []).filter((entry) =>
    Array.isArray(entry.value) ? entry.value.length > 0 : entry.value != null && entry.value !== ''
  )

  const handleRewrite = async (source: 'title' | 'meaning' | 'property') => {
    setRewriting(source)
    setRewriteError(null)
    setSceneOptions([])
    try {
      if (source === 'title') {
        const brief = await previewBrief(item.id)
        applyScene(brief.scene_prompt, brief.image_description)
      } else {
        const { options, description } = await rewriteScenePrompt(
          item.id,
          source === 'property' ? selectedProperties : undefined
        )
        if (options.length === 1) applyScene(options[0].scene_prompt, description)
        else {
          setSceneOptions(options)
          // 候補が複数あるときは、選んだ時点で同じ説明文を添える
          setPendingDescription(description)
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setRewriteError(axiosErr?.response?.data?.error ?? '書き直せませんでした。時間を置いてお試しください。')
    } finally {
      setRewriting(null)
    }
  }

  const handleRegenerate = async () => {
    setRetrying(true)
    setError(null)
    try {
      // 指示を直していたら先に保存する。直してから作り直すまでを1回で終える。
      // 書き直しの根拠になった説明文も一緒に保存し、プロンプト情報を揃える
      const sceneChanged = scenePrompt !== (item.scene_prompt ?? '')
      const descriptionChanged = Boolean(pendingDescription) && pendingDescription !== (item.image_description ?? '')
      if (sceneChanged || descriptionChanged) {
        onUpdated(
          await updateItem(item.id, {
            ...(sceneChanged ? { scene_prompt: scenePrompt } : {}),
            ...(descriptionChanged ? { image_description: pendingDescription! } : {}),
          })
        )
      }
      const updated = await retryItem(item.id, {
        customPrompt: customPrompt.trim(),
        style,
        framing,
        useMeaning: showMeaningOption ? useMeaning : false,
        imageModel,
      })
      onUpdated(updated)
      // 消費したぶんを残高表示へ反映する（ヘッダーと共有）
      if (costsCredit) useBillingStore.getState().fetchSummary()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      setError(
        axiosErr?.response?.data?.error ??
          axiosErr?.response?.data?.errors?.[0] ??
          '作り直せませんでした。もう一度試してください。'
      )
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={panel.open}
        aria-expanded={panel.isOpen}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <RefreshCw size={14} />
        イメージ再生成{costsCredit && `（1 ${CREDIT_UNIT_SHORT}）`}
      </button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-4">
          {isFailed && item.generation_error && (
            <p className="text-sm leading-6 text-destructive">{item.generation_error}</p>
          )}

          {blocked && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              このままでは同じ結果になります。単語を具体的にするか、下の「画像への指示」を変えてからお試しください。
            </p>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            {costsCredit ? (
              <>
                作り直しには 1 {CREDIT_UNIT_SHORT} を使用します（新しい画像を1枚作るため）。
                {available !== null && <>　残り {available} {CREDIT_UNIT_SHORT}</>}
              </>
            ) : (
              <>生成に失敗した場合の作り直しは無料です。</>
            )}
          </p>

          {/* 思った絵にならないとき、いちばん効くのがここ。直してそのまま作り直せるようにする */}
          <div className="space-y-2">
            <Label htmlFor="regen-scene">画像への指示</Label>

            {/* AI に書かせる入口はここだけに集める（見るだけの「プロンプト情報」には置かない）。
                字だけのリンクだと、思った絵にならないときいちばん効く操作が
                見出しの脇に埋もれる。押せるものとして枠を付け、横並びに置く。

                2つは根拠が違う。単語からは語だけを見て起こし直し、
                意味・説明からは、このカードに書いてある説明だけを見て起こし直す。 */}
            {/* 横長の札を縦に積む。3つを横に並べると1つが狭くなり、
                根拠の説明（選ぶのに要る一行）が読めなくなる */}
            <div className="space-y-1.5">
              <RewriteButton
                busy={rewriting === 'title'}
                disabled={retrying || Boolean(rewriting)}
                onClick={() => handleRewrite('title')}
                title="単語から書き直す"
                note="語だけを見て起こし直します"
              />
              {hasMeaning && (
                <RewriteButton
                  busy={rewriting === 'meaning'}
                  disabled={retrying || Boolean(rewriting)}
                  onClick={() => handleRewrite('meaning')}
                  title="意味・説明から書き直す"
                  note="このカードの説明だけを根拠にします"
                />
              )}
              {filledProperties.length > 0 && (
                <RewriteButton
                  busy={rewriting === 'property'}
                  disabled={retrying || Boolean(rewriting)}
                  onClick={() => setPickingProperties((v) => !v)}
                  title="特定の項目から書き直す"
                  note={
                    selectedProperties.length > 0
                      ? `${selectedProperties.length} 個の項目を根拠にします`
                      : 'Wikipedia やメモなど、選んだ項目を根拠にします'
                  }
                />
              )}
            </div>

            {/* 選ぶ口は押した先に出す。並べて出すと、根拠を選ぶ前に押せてしまう */}
            {pickingProperties && (
              <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">根拠にする項目を選びます（複数可）</p>
                <div className="flex flex-wrap gap-1.5">
                  {filledProperties.map((entry) => {
                    const active = selectedProperties.includes(entry.key)
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() =>
                          setSelectedProperties((current) =>
                            current.includes(entry.key)
                              ? current.filter((k) => k !== entry.key)
                              : [...current, entry.key]
                          )
                        }
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          active
                            ? 'border-transparent text-white'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                        style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                      >
                        {entry.label}
                      </button>
                    )
                  })}
                </div>
                <Button
                  size="sm"
                  disabled={selectedProperties.length === 0 || Boolean(rewriting)}
                  onClick={() => handleRewrite('property')}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {rewriting === 'property' ? <Spinner size={12} /> : <Sparkles size={12} />}
                  この項目から書き直す
                </Button>
              </div>
            )}

            <textarea
              id="regen-scene"
              value={scenePrompt}
              onChange={(e) => {
                // 手で書き始めたら、書き直し前の内容へ戻す道は畳む（もう別物なので）
                setBeforeRewrite(null)
                setScenePrompt(e.target.value)
              }}
              disabled={retrying || Boolean(rewriting)}
              rows={4}
              placeholder="未設定のときは単語をそのまま使います"
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed placeholder:font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ここを直すと、そのまま作り直しに使われます。空にすると単語をそのまま使います。
              </p>
              {beforeRewrite !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setScenePrompt(beforeRewrite)
                    setBeforeRewrite(null)
                  }}
                  disabled={retrying}
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <Undo2 size={12} />
                  書き直す前に戻す
                </button>
              )}
            </div>
            {rewriteError && <p className="text-xs text-destructive">{rewriteError}</p>}

            {/* 絵がまるで変わるほど意味・ジャンルが分かれる語では候補が返る。選ぶのは利用者 */}
            {sceneOptions.length > 1 && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  この語には絵が変わるほど違う意味があります。どれで作りますか。
                </p>
                {sceneOptions.map((option, index) => (
                  <button
                    key={`${option.label ?? ''}-${index}`}
                    type="button"
                    onClick={() => applyScene(option.scene_prompt)}
                    disabled={retrying}
                    className="block w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {option.label && <span className="block text-xs font-medium">{option.label}</span>}
                    <span className="mt-0.5 block line-clamp-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {option.scene_prompt}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="regen-instruction">入力補足・指示（任意）</Label>
            <textarea
              id="regen-instruction"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={retrying}
              maxLength={CUSTOM_PROMPT_MAX_LENGTH}
              rows={2}
              placeholder="例: もっと写実的に / 背景を青空に / りんごは断面を見せて"
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* 構図。人物の肖像が欲しいのに引きの絵になる、を直せる唯一の入口 */}
          <div className="space-y-2">
            <Label>構図（任意）</Label>
            <div className="flex flex-wrap gap-2">
              {FRAMING_OPTIONS.map((opt) => {
                const active = framing === opt.value
                return (
                  <button
                    key={opt.value || 'default'}
                    type="button"
                    onClick={() => setFraming(opt.value)}
                    disabled={retrying}
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

          {/* 作り直しのついでにモデルを変えられる。選べるものが1つなら出ない */}
          <ImageModelPicker value={imageModel} onChange={setImageModel} disabled={retrying} />

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
                    disabled={retrying}
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
          </div>

          {showMeaningOption && (
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
              <input
                type="checkbox"
                checked={useMeaning}
                onChange={(e) => {
                  meaningTouched.current = true
                  setUseMeaning(e.target.checked)
                }}
                disabled={retrying}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">意味・説明を参考にする</span>
                <span className="block text-xs text-muted-foreground">
                  このカードの意味・説明文を画像生成のヒントに加えます（既定は環境設定で変更できます）。
                  画像への指示を書くと、そちらが優先されるためこの項目は消えます。
                </span>
              </span>
            </label>
          )}

          <Button
            onClick={handleRegenerate}
            disabled={retrying || insufficient || blocked}
            className="flex w-full items-center justify-center gap-2"
          >
            {retrying ? <Spinner size={15} /> : <RefreshCw size={15} />}
            {retrying ? '作り直しています...' : `この内容で作り直す${costsCredit ? `（1 ${CREDIT_UNIT_SHORT}）` : ''}`}
          </Button>

          {insufficient && (
            <p className="text-sm text-destructive">クレジットが不足しています。</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </PanelSlotContent>
    </>
  )
}

/**
 * 指示を書き直させるボタン。
 *
 * 字だけのリンクだと、思った絵にならないときいちばん効く操作が見出しの脇に埋もれる。
 * 押せるものとして枠を持たせ、何を根拠に書き直すのかを一行添える。
 * 2つの違いは根拠だけなので、そこを読ませないと選びようがない。
 */
function RewriteButton({
  busy,
  disabled,
  onClick,
  title,
  note,
}: {
  busy: boolean
  disabled: boolean
  onClick: () => void
  title: string
  note: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-[var(--palace)]/50 hover:bg-muted/50 disabled:opacity-50"
    >
      <span className="mt-0.5 shrink-0" style={{ color: 'var(--palace)' }}>
        {busy ? <Spinner size={13} /> : <Sparkles size={13} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
    </button>
  )
}
