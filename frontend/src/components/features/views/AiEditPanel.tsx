'use client'

import { useState, type ReactNode } from 'react'
import { Wand2, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { aiEditView, createCardsOnView, proposeCards, redoView, undoView } from '@/lib/api/views'
import type {
  AiEditEdgeMode,
  AiEditLayout,
  AiEditMode,
  AiEditPlacementMode,
  AiEditSizeMode,
  AiEditSummary,
  CardEdge,
  CardProposal,
  CardReuse,
  ViewDetail,
} from '@/types/view'

// 並べ方の指定。おまかせ以外を選ぶと、その形になるよう AI へ規則を足す
const LAYOUTS: { value: AiEditLayout; label: string }[] = [
  { value: 'auto', label: 'おまかせ' },
  { value: 'hierarchy', label: '階層（上→下）' },
  { value: 'radial', label: '放射（中心から）' },
  { value: 'flow', label: '流れ（左→右）' },
  { value: 'grid', label: '格子' },
]

// どこまで整えるか。ジャンル別に実行できるようにし、選ばなかったものは触らない。
// 「触らない」を2つ手で選ばせるより、押したボタンで範囲が決まる方が迷わない
type EditScope = 'all' | 'cards' | 'edges' | 'layout'

const PANEL_KEY = 'canvas-ai-edit'
const MAX_INSTRUCTION = 500

// 「カードから作る」は新しくカードを作る（＝クレジットを使う）ので、他の2つとは性質が違う。
// 同じ並びに置きつつ、実行前に必ず枚数の確認を挟む
type EditChoice = AiEditMode | 'create'

const MODES: { value: EditChoice; label: string; description: string }[] = [
  {
    value: 'placed_only',
    label: 'いまあるカードだけ',
    description: 'すでに置いてあるカードだけで組み直します。',
  },
  {
    value: 'select',
    label: 'カードを選ぶところから',
    description: '手持ちのカードから、指示に合うものを探して足します。',
  },
  {
    value: 'create',
    label: 'カードから作る（cr消費）',
    description: '足りないカードをAIが提案します。作る前に枚数を確認でき、作った枚数ぶんクレジットを使います。',
  },
]

const EXAMPLES: Record<string, string> = {
  deck: '例: 覚えやすい順に並べ替えて',
  freeboard: '例: 原因と結果が分かるように並べて、線でつないで',
}

/**
 * ことばの指示でキャンバスを組み立て直す。
 *
 * ページ上はボタンと「戻る／進む」だけにして、指示の入力は右パネルで行う。
 * 盤そのものを見る面積を、設定のために削らないため。
 *
 * 戻る／進むは一手で効いてほしいので、ページ側に置いたままにする。
 */
export function AiEditPanel({
  viewId,
  viewType,
  canUndo,
  canRedo,
  onApplied,
}: {
  viewId: string
  viewType: string
  canUndo: boolean
  canRedo: boolean
  /** 編集後のキャンバス。呼び出し側で描き直す */
  onApplied: (view: ViewDetail) => void
}) {
  const panel = usePanelForm(PANEL_KEY, 'AIに整えてもらう')
  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState<EditChoice>('placed_only')
  const [busy, setBusy] = useState<'edit' | 'undo' | 'redo' | 'propose' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiEditSummary | null>(null)
  // 提案（まだ作っていない）と、そのうち作るものの選択
  const [proposals, setProposals] = useState<CardProposal[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [credits, setCredits] = useState<number | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  // 手持ちから組み込むもの（作らないのでクレジットは要らない）と、図のつながり
  const [reuse, setReuse] = useState<CardReuse[]>([])
  const [edges, setEdges] = useState<CardEdge[]>([])
  const [limit, setLimit] = useState<{ max: number; truncated: boolean } | null>(null)
  // 整え方の方針。既定は従来と同じ（おまかせ・線は引き直す・大きさは AI に任せる）
  const [layout, setLayout] = useState<AiEditLayout>('auto')
  const [edgeMode, setEdgeMode] = useState<AiEditEdgeMode>('rebuild')
  const [sizeMode, setSizeMode] = useState<AiEditSizeMode>('ai')
  const [placementMode, setPlacementMode] = useState<AiEditPlacementMode>('arrange')
  const [createdCount, setCreatedCount] = useState<number | null>(null)
  const [arranged, setArranged] = useState(false)

  // 「カードから作る」は提案を出すだけ。作るのは確認したあと
  // 「作る」も「手持ちから足す」も、いきなり適用せず一覧で見せてから決める
  const propose = async (source: 'create' | 'select') => {
    const trimmed = instruction.trim()
    if (!trimmed || busy) return
    setBusy('propose')
    setError(null)
    setProposals(null)
    setCreatedCount(null)
    try {
      const result = await proposeCards(viewId, trimmed, { source })
      setProposals(result.proposals)
      setPlan(result.plan)
      setReuse(result.reuse)
      setEdges(result.edges)
      setLimit({ max: result.max_count, truncated: result.truncated })
      setChosen(new Set(result.proposals.map((p) => p.title)))
      setCredits(result.available_credits)
      if (result.proposals.length === 0 && result.reuse.length === 0) {
        setError('足すべきカードは見つかりませんでした。')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '提案を作れませんでした。')
    } finally {
      setBusy(null)
    }
  }

  const createChosen = async () => {
    if (busy || (chosen.size === 0 && reuse.length === 0)) return
    setBusy('create')
    setError(null)
    try {
      // 承認した設計をそのまま渡す。指示文だけ渡し直すと、AI が一から考え直して別の図になる
      const updated = await createCardsOnView(viewId, [...chosen], {
        instruction: instruction.trim(),
        reuseIds: reuse.map((row) => row.id),
        plan,
        edges,
      })
      onApplied(updated)
      setCreatedCount(updated.created_cards?.count ?? chosen.size)
      setArranged(updated.created_cards?.arranged ?? false)
      setProposals(null)
      setPlan(null)
      setReuse([])
      setEdges([])
      setChosen(new Set())
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'カードを作れませんでした。')
    } finally {
      setBusy(null)
    }
  }

  // 範囲に応じて、触らない項目を自動で「そのまま」にする
  const canRun = busy === null && instruction.trim().length > 0

  const optionsFor = (scope: EditScope) => ({
    layout,
    placement: scope === 'all' || scope === 'layout' ? placementMode : ('keep' as const),
    edges: scope === 'all' || scope === 'edges' ? edgeMode : ('keep' as const),
    sizing: scope === 'all' || scope === 'cards' ? sizeMode : ('keep' as const),
  })

  const run = async (scope: EditScope = 'all') => {
    // カードを足す2つの方針は、提案→承認を挟む
    if (scope === 'all' || scope === 'cards') {
      if (mode === 'create') return propose('create')
      if (mode === 'select') return propose('select')
    }
    const trimmed = instruction.trim()
    if (!trimmed || busy) return
    setBusy('edit')
    setError(null)
    setResult(null)
    try {
      // 線や配置だけを整えるときは、カードを足さない（範囲の外なので）
      const editMode: AiEditMode = scope === 'all' || scope === 'cards' ? (mode as AiEditMode) : 'placed_only'
      const updated = await aiEditView(viewId, trimmed, editMode, optionsFor(scope))
      setResult(updated.ai_edit ?? null)
      onApplied(updated)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '編集できませんでした。時間を置いてお試しください。')
    } finally {
      setBusy(null)
    }
  }

  const step = async (direction: 'undo' | 'redo') => {
    if (busy) return
    setBusy(direction)
    setError(null)
    try {
      onApplied(await (direction === 'undo' ? undoView(viewId) : redoView(viewId)))
      setResult(null)
    } catch {
      setError(direction === 'undo' ? '戻せませんでした' : '進めませんでした')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={panel.open}
          className="flex items-center gap-1.5"
          aria-expanded={panel.isOpen}
        >
          <Wand2 size={15} />
          AIに整えてもらう
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => step('undo')}
          disabled={!canUndo || busy !== null}
          aria-label="AI調整を戻す"
          title="AI調整を戻す"
          className="flex items-center gap-1"
        >
          {busy === 'undo' ? <Spinner size={14} /> : <Undo2 size={15} />}
          戻る
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step('redo')}
          disabled={!canRedo || busy !== null}
          aria-label="AI調整をやり直す"
          title="AI調整をやり直す"
          className="flex items-center gap-1"
        >
          {busy === 'redo' ? <Spinner size={14} /> : <Redo2 size={15} />}
          進む
        </Button>

        {error && !panel.isOpen && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            やりたいことをことばで書くと、AI が並べ替え
            {viewType === 'freeboard' && '・配置・線つなぎ'}を代わりに行います。
            結果が違ったときは「戻る」で元に戻せます。
          </p>

          <div>
            <label htmlFor="ai-edit-instruction" className="mb-1 block text-xs text-muted-foreground">
              指示
            </label>
            <Input
              id="ai-edit-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                // 日本語入力の変換確定 Enter で実行してしまわないようにする
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) run()
              }}
              placeholder={EXAMPLES[viewType] ?? '例: 意味のまとまりごとに並べて'}
              maxLength={MAX_INSTRUCTION}
              disabled={busy !== null}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {instruction.length} / {MAX_INSTRUCTION}
            </p>
          </div>

          {/*
            ジャンルごとに区切り、それぞれに実行ボタンを置く。
            押したボタンの範囲だけが変わり、他は触らない。
            「触らない」を手で2つ選ばせるより、押した場所で範囲が決まる方が迷わない。
          */}
          <Section
            title="カード"
            description="どのカードを使うか・大きさ"
            action={
              viewType === 'freeboard' && mode !== 'create' ? (
                <RunButton label="カードを整える" busy={busy === 'edit'} disabled={!canRun} onClick={() => run('cards')} />
              ) : undefined
            }
          >
            <Choice
              label="使うカード"
              options={MODES.map((option) => ({ value: option.value, label: option.label }))}
              value={mode}
              onChange={(value) => setMode(value as EditChoice)}
              disabled={busy !== null}
              hint={MODES.find((option) => option.value === mode)?.description}
            />

            {viewType === 'freeboard' && mode !== 'create' && (
              <Choice
                label="大きさ"
                options={[
                  { value: 'ai', label: 'AIが強弱をつける' },
                  { value: 'uniform', label: '全部そろえる' },
                  { value: 'keep', label: '触らない' },
                ]}
                value={sizeMode}
                onChange={(value) => setSizeMode(value as AiEditSizeMode)}
                disabled={busy !== null}
              />
            )}
          </Section>

          {viewType === 'freeboard' && mode !== 'create' && (
            <>
              <Section
                title="線"
                description="どうつなぐか"
                action={<RunButton label="線を整える" busy={busy === 'edit'} disabled={!canRun} onClick={() => run('edges')} />}
              >
                <Choice
                  options={[
                    { value: 'rebuild', label: '指示どおりに引き直す' },
                    { value: 'infer', label: '意味を読んで関係を見つけて引く' },
                    { value: 'keep', label: 'いまの線をそのままにする' },
                  ]}
                  value={edgeMode}
                  onChange={(value) => setEdgeMode(value as AiEditEdgeMode)}
                  disabled={busy !== null}
                  hint={
                    edgeMode === 'infer'
                      ? 'カードの意味・説明を読み、原因と結果・上位と下位・対比などの関係を見つけて結びます。根拠のない線は引きません。'
                      : edgeMode === 'keep'
                        ? '手で描いた線が並べ替えで消えません。'
                        : '指示にある関係だけを引き直します。'
                  }
                />
              </Section>

              <Section
                title="全体・配置"
                description="どう並べるか"
                action={<RunButton label="配置を整える" busy={busy === 'edit'} disabled={!canRun} onClick={() => run('layout')} />}
              >
                <Choice
                  options={[
                    ...LAYOUTS.map((option) => ({ value: option.value, label: option.label })),
                    { value: 'keep', label: '触らない' },
                  ]}
                  value={placementMode === 'keep' ? 'keep' : layout}
                  onChange={(value) => {
                    if (value === 'keep') {
                      setPlacementMode('keep')
                      return
                    }
                    setPlacementMode('arrange')
                    setLayout(value as AiEditLayout)
                  }}
                  disabled={busy !== null}
                />
              </Section>
            </>
          )}

          <Button
            onClick={() => run('all')}
            disabled={busy !== null || !instruction.trim()}
            className="flex w-full items-center justify-center gap-1.5"
          >
            {busy === 'edit' || busy === 'propose' ? <Spinner size={14} /> : <Wand2 size={14} />}
            {mode === 'create'
              ? busy === 'propose'
                ? '考え中…'
                : '作るカードを提案してもらう'
              : busy === 'edit'
                ? '編集中…'
                : '整える'}
          </Button>

          {/* 提案の確認。作ると1枚1クレジット出ていくので、枚数を見せてから決めてもらう */}
          {proposals && (proposals.length > 0 || reuse.length > 0) && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              {/* 何を作ろうとしているのかを先に見せる。部品だけ並べても図の姿が分からない */}
              {plan && (
                <p className="rounded border-l-2 border-[var(--palace)] bg-background/60 px-2 py-1.5 text-xs leading-relaxed">
                  {plan}
                </p>
              )}

              {proposals.length > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  図の部品として作るカード（{proposals.length}件）
                  {limit && <span className="ml-1.5 text-xs font-normal text-muted-foreground">最大{limit.max}件</span>}
                </p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setChosen(chosen.size === proposals.length ? new Set() : new Set(proposals.map((p) => p.title)))
                  }
                >
                  {chosen.size === proposals.length ? 'すべて外す' : 'すべて選ぶ'}
                </button>
              </div>
              )}

              {proposals.length > 0 && (
              <ul className="space-y-1">
                {proposals.map((proposal) => (
                  <li key={proposal.title}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={chosen.has(proposal.title)}
                        disabled={busy !== null}
                        onChange={(e) => {
                          const next = new Set(chosen)
                          if (e.target.checked) next.add(proposal.title)
                          else next.delete(proposal.title)
                          setChosen(next)
                        }}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        {proposal.title}
                        {proposal.reason && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{proposal.reason}</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              )}

              {/* 上限で切ったなら伝える。黙って減らすと図の抜けに気づけない */}
              {limit?.truncated && (
                <p className="rounded border border-amber-300/60 bg-amber-50/60 px-2 py-1.5 text-xs">
                  1回の上限（{limit.max}件）に収まらなかったため、一部を省いています。
                  作ったあと、続きをもう一度お願いすると足せます。
                </p>
              )}

              {reuse.length > 0 && (
                <div className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                  <p className="text-xs font-medium">
                    手持ちから足すカード（{reuse.length}件・クレジット不要）
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {reuse.map((row) => row.title).join('、')}
                  </p>
                </div>
              )}

              {edges.length > 0 && (
                <details className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                  <summary className="cursor-pointer text-xs font-medium">つなぐ組み合わせ（{edges.length}本）</summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {edges.map((edge) => (
                      <li key={`${edge.from}-${edge.to}`}>
                        {edge.from} → {edge.to}
                        {edge.label && `（${edge.label}）`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <p className="text-xs text-muted-foreground">
                {chosen.size} 枚を作ります（{chosen.size} クレジット使います
                {credits !== null && `・残高 ${credits}`}）。画像はこのあと順に作られます。
                {viewType === 'freeboard' && '作成後、指示に沿って配置と線つなぎまで行います。'}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={createChosen}
                  disabled={busy !== null || (chosen.size === 0 && reuse.length === 0)}
                >
                  {busy === 'create' ? <Spinner size={14} /> : null}
                  {chosen.size > 0
                    ? `この${chosen.size}枚を作る${reuse.length > 0 ? `＋${reuse.length}枚を足す` : ''}`
                    : `この${reuse.length}枚を足す`}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setProposals(null)} disabled={busy !== null}>
                  やめる
                </Button>
              </div>
            </div>
          )}

          {createdCount !== null && (
            <p className="text-sm text-muted-foreground">
              {createdCount} 枚を作って{arranged ? '図として組み上げました' : 'キャンバスに置きました'}。
            </p>
          )}

          {result && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-sm">{result.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                追加 {result.added} / 取り外し {result.removed} / 配置 {result.placed}
                {viewType === 'freeboard' && <> / 線 {result.connected}</>}
              </p>
              {result.notes && (
                <p className="mt-2 border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground">
                  AIからの補足: {result.notes}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </PanelSlotContent>
    </>
  )
}

// ジャンルの区切り。見出し・説明と、その範囲だけを実行するボタンを持つ
function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-2 rounded-lg border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function RunButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled} className="shrink-0">
      {busy ? <Spinner size={13} /> : <Wand2 size={13} />}
      {label}
    </Button>
  )
}

// 縦並びの単一選択。選択肢の文言が長く、横並びだと折り返して読みにくい
function Choice({
  label,
  options,
  value,
  onChange,
  disabled,
  hint,
}: {
  label?: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  disabled: boolean
  hint?: string
}) {
  return (
    <div>
      {label && <p className="mb-1 text-xs text-muted-foreground">{label}</p>}
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={value === option.value ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className="w-full justify-start"
          >
            {option.label}
          </Button>
        ))}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
