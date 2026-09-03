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
  AiEditDirection,
  AiEditChangeScale,
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
/**
 * 図の形。**説明を添える。**
 *
 * 名前だけでは、階層と放射とマインドマップの違いが読み取れない。
 * どんな図になるのかが分からないまま選ばせると、押して確かめるしかなくなる。
 */
const LAYOUTS: { value: AiEditLayout; label: string; hint: string }[] = [
  { value: 'auto', label: 'おまかせ', hint: '関係の張られ方から、合う形を選びます' },
  { value: 'hierarchy', label: '階層図', hint: '根から枝分かれ。分類・系統・組織' },
  { value: 'flow', label: '流れ図', hint: '順序のあるものを一列に。手順・時系列・因果' },
  { value: 'mindmap', label: 'マインドマップ', hint: '中心から左右へ。発想を広げる' },
  { value: 'radial', label: '放射図', hint: '中心から360度へ。中心からの遠さに意味がある' },
  { value: 'network', label: '関係図', hint: '上下が無い網の目。人物の相関など' },
  { value: 'cluster', label: 'グループ図', hint: 'まとまりごとに島を作る' },
  { value: 'grid', label: '格子', hint: '並べるだけ' },
]

/**
 * 流れの向き。**種別とは別に選べる。**
 *
 * 「階層＝上から下」「流れ＝左から右」と結びついていたが、
 * 組織図を横に伸ばしたいことも、手順を縦に並べたいこともある。
 * 向きだけ変えたいのに種別を選び直させるのは、別のことを選ばせている
 */
const DIRECTIONS: { value: AiEditDirection; label: string; hint: string }[] = [
  { value: 'auto', label: 'おまかせ', hint: '階層図は上から下、流れ図は左から右になります' },
  { value: 'down', label: '上から下', hint: '縦に伸びます' },
  { value: 'right', label: '左から右', hint: '横に伸びます' },
]

/** どれだけ動かしてよいか。「いまの形を活かす」をここへ吸収する */
const CHANGE_SCALES: { value: AiEditChangeScale; label: string; hint: string }[] = [
  { value: 'small', label: '控えめ', hint: 'いまの形をできるだけ残します' },
  { value: 'medium', label: 'ふつう', hint: '読みやすさといまの形の釣り合いを取ります' },
  { value: 'large', label: '大胆に', hint: '読みやすさを優先して並べ直します' },
]

// どこまで整えるか。ジャンル別に実行できるようにし、選ばなかったものは触らない。
// 「触らない」を2つ手で選ばせるより、押したボタンで範囲が決まる方が迷わない
type EditScope = 'all' | 'cards' | 'edges' | 'edge_labels' | 'layout'

// 実行の結果に、どこまでが対象だったかを添える
const SCOPE_LABELS: Record<EditScope, string> = {
  all: 'カード・線・配置をまとめて整えました',
  cards: 'カードだけ整えました（線と配置はそのまま）',
  edges: '線だけ整えました（カードと配置はそのまま）',
  edge_labels: '線の文言だけ整えました（つなぎ方・見た目・カード・配置はそのまま）',
  layout: '配置だけ整えました（カードと線はそのまま）',
}

const PANEL_KEY = 'canvas-ai-edit'
const MAX_INSTRUCTION = 500
const DEFAULT_EDGE_LABEL_INSTRUCTION = '線上の文言を、カード同士の関係と向きに合う具体的な短い言葉へ直して'

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
  viewName,
  canUndo,
  canRedo,
  onApplied,
  children,
}: {
  viewId: string
  viewType: string
  /** キャンバスの名前。**空欄のときの指示になる**ので、押す前に見せる */
  viewName?: string
  canUndo: boolean
  canRedo: boolean
  /** 編集後のキャンバス。呼び出し側で描き直す */
  onApplied: (view: ViewDetail) => void
  /** ボードでは操作をキャンバスのツールバー内へ差し込む */
  children?: (controls: { editAction: ReactNode; historyActions: ReactNode }) => ReactNode
}) {
  const panel = usePanelForm(PANEL_KEY, 'AIで整える')
  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState<EditChoice>('placed_only')
  const [busy, setBusy] = useState<'edit' | 'undo' | 'redo' | 'propose' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiEditSummary | null>(null)
  // いま何を実行しているか／何を実行した結果か。どこまで変わるのかを迷わせないため
  const [runningScope, setRunningScope] = useState<EditScope | null>(null)
  const [doneScope, setDoneScope] = useState<EditScope | null>(null)
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
  const [direction, setDirection] = useState<AiEditDirection>('auto')
  const [changeScale, setChangeScale] = useState<AiEditChangeScale>('medium')
  const [createdCount, setCreatedCount] = useState<number | null>(null)
  const [arranged, setArranged] = useState(false)

  // 「カードから作る」は提案を出すだけ。作るのは確認したあと
  // 「作る」も「手持ちから足す」も、いきなり適用せず一覧で見せてから決める
  const propose = async (source: 'create' | 'select') => {
    // ここは**空欄では動かない**。どんなカードを作るか／どれを足すかは、
    // ボードの名前だけでは決められない（何を足すかは指示そのもの）
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
  // 空欄でも押せる。空ならボードの名前が指示になる（サーバー側で補う）。
  // 名前も無いときだけ、サーバーが理由を返す
  /**
   * 押せるかどうか。
   *
   * **並べ直すだけなら空欄でよい**（サーバーがボードの名前を指示にする）。
   * カードを足す2つの方針だけは、空欄では決められない
   * ——「何を作るか」「どれを足すか」は、名前ではなく指示そのものだから。
   */
  const needsInstruction = mode === 'create' || mode === 'select'
  const canRunScope = (scope: EditScope) =>
    busy === null && (!(scope === 'all' || scope === 'cards') || !needsInstruction || instruction.trim().length > 0)
  const canRun = canRunScope('all')

  const optionsFor = (scope: EditScope) => ({
    layout,
    placement: scope === 'all' || scope === 'layout' ? placementMode : ('keep' as const),
    direction: scope === 'all' || scope === 'layout' ? direction : undefined,
    change_scale: scope === 'all' || scope === 'layout' ? changeScale : undefined,
    edges: scope === 'edge_labels' ? ('relabel' as const) : scope === 'all' || scope === 'edges' ? edgeMode : ('keep' as const),
    sizing: scope === 'all' || scope === 'cards' ? sizeMode : ('keep' as const),
  })

  const run = async (scope: EditScope = 'all') => {
    // カードを足す2つの方針は、提案→承認を挟む
    if (scope === 'all' || scope === 'cards') {
      if (mode === 'create') return propose('create')
      if (mode === 'select') return propose('select')
    }
    // 空欄でよい。**サーバーがボードの名前を指示にする。**
    // 線の文字だけを付け直すときは、決まった言い方を先に当てる
    const trimmed = instruction.trim() || (scope === 'edge_labels' ? DEFAULT_EDGE_LABEL_INSTRUCTION : '')
    if (busy) return
    setBusy('edit')
    setRunningScope(scope)
    setError(null)
    setResult(null)
    setDoneScope(null)
    try {
      // 線や配置だけを整えるときは、カードを足さない（範囲の外なので）
      const editMode: AiEditMode = scope === 'all' || scope === 'cards' ? (mode as AiEditMode) : 'placed_only'
      const updated = await aiEditView(viewId, trimmed, editMode, optionsFor(scope))
      setResult(updated.ai_edit ?? null)
      setDoneScope(scope)
      onApplied(updated)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '編集できませんでした。時間を置いてお試しください。')
    } finally {
      setBusy(null)
      setRunningScope(null)
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

  const editAction = (
    <Button
      variant="outline"
      size="sm"
      onClick={panel.open}
      className="flex items-center gap-1.5"
      aria-expanded={panel.isOpen}
    >
      <Wand2 size={15} />
      AIで整える
    </Button>
  )
  const historyActions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => step('undo')}
        disabled={!canUndo || busy !== null}
        aria-label="戻る"
        title="戻る"
        className="h-8 w-8 p-0"
      >
        {busy === 'undo' ? <Spinner size={14} /> : <Undo2 size={15} />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => step('redo')}
        disabled={!canRedo || busy !== null}
        aria-label="進む"
        title="進む"
        className="h-8 w-8 p-0"
      >
        {busy === 'redo' ? <Spinner size={14} /> : <Redo2 size={15} />}
      </Button>
    </>
  )

  return (
    <>
      {children ? (
        <>
          {children({ editAction, historyActions })}
          {error && !panel.isOpen && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {editAction}
          {historyActions}
          {error && !panel.isOpen && <span className="text-sm text-destructive">{error}</span>}
        </div>
      )}

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            やりたいことをことばで書くと、AI が並べ替え
            {viewType === 'freeboard' && '・配置・線つなぎ'}を代わりに行います。
            結果が違ったときは「戻る」で元に戻せます。
          </p>

          <div>
            <label htmlFor="ai-edit-instruction" className="mb-1 block text-xs text-muted-foreground">
              指示（空欄でもよい）
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
            <div className="mt-1 flex items-baseline justify-between gap-2">
              {/* 空欄のときに何が起きるかを、押す前に言う。
                  名前は「何の図か」を既に言っているので、書き写させない */}
              <p className="text-xs text-muted-foreground">
                {instruction.trim()
                  ? '\u00A0'
                  : needsInstruction
                    ? 'カードを足すときは、何を足すかを書いてください'
                    : `空欄なら「${viewName ?? 'このボード'}」を指示にします`}
              </p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {instruction.length} / {MAX_INSTRUCTION}
              </p>
            </div>
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
                <RunButton
                  label="カードだけ整える"
                  busy={runningScope === 'cards'}
                  disabled={!canRunScope('cards')}
                  onClick={() => run('cards')}
                />
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
                action={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <RunButton
                      label="文言だけ整える"
                      busy={runningScope === 'edge_labels'}
                      disabled={busy !== null}
                      onClick={() => run('edge_labels')}
                    />
                    <RunButton
                      label="線だけ整える"
                      busy={runningScope === 'edges'}
                      disabled={!canRunScope('edges')}
                      onClick={() => run('edges')}
                    />
                  </div>
                }
              >
                <Choice
                  options={[
                    { value: 'rebuild', label: '指示どおりに引き直す' },
                    { value: 'infer', label: '意味を読んで関係を見つけて引く' },
                    { value: 'restyle', label: '文字と見た目だけ整える' },
                    { value: 'keep', label: 'いまの線をそのままにする' },
                  ]}
                  value={edgeMode}
                  onChange={(value) => setEdgeMode(value as AiEditEdgeMode)}
                  disabled={busy !== null}
                  hint={
                    edgeMode === 'infer'
                      ? 'カードの意味・説明を読み、原因と結果・上位と下位・対比などの関係を見つけて結びます。根拠のない線は引きません。'
                      : edgeMode === 'restyle'
                        ? 'つなぎ方は変えず、線の文字づかいを揃え、意味の違いが目で分かる太さ・色にします。折れ点も残ります。'
                        : edgeMode === 'keep'
                          ? '手で描いた線が並べ替えで消えません。'
                          : '指示にある関係だけを引き直します。'
                  }
                />
              </Section>

              <Section
                title="全体・配置"
                description="どう並べるか"
                action={
                  <RunButton
                    label="配置だけ整える"
                    busy={runningScope === 'layout'}
                    disabled={!canRunScope('layout')}
                    onClick={() => run('layout')}
                  />
                }
              >
                <Choice
                  options={[
                    ...LAYOUTS,
                    { value: 'keep', label: '触らない', hint: 'いまの置き場所をそのままにします' },
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

                {/* 向きと変更量は、**置き場所を触るときだけ**意味がある。
                    触らない設定のときに出すと、押しても何も起きない設定が並ぶ */}
                {placementMode !== 'keep' && (
                  <>
                    <div className="mt-3">
                      <Choice
                        label="流れの向き"
                        options={DIRECTIONS}
                        value={direction}
                        onChange={(value) => setDirection(value as AiEditDirection)}
                        disabled={busy !== null}
                      />
                    </div>
                    <div className="mt-3">
                      <Choice
                        label="変更量"
                        options={CHANGE_SCALES}
                        value={changeScale}
                        onChange={(value) => setChangeScale(value as AiEditChangeScale)}
                        disabled={busy !== null}
                      />
                    </div>
                  </>
                )}
              </Section>
            </>
          )}

          <Button
            onClick={() => run('all')}
            disabled={!canRun}
            className="flex w-full items-center justify-center gap-1.5"
          >
            {busy === 'edit' || busy === 'propose' ? <Spinner size={14} /> : <Wand2 size={14} />}
            {mode === 'create'
              ? busy === 'propose'
                ? '考え中…'
                : '作るカードを提案してもらう'
              : runningScope === 'all'
                ? 'すべて整えています…'
                : viewType === 'freeboard'
                  ? 'すべて整える（カード・線・配置）'
                  : '整える'}
          </Button>

          {/* どこまでが変わるのかを、実行の前後で分かるようにする */}
          {viewType === 'freeboard' && mode !== 'create' && !runningScope && !result && (
            <p className="text-center text-2xs text-muted-foreground">
              各項目の「〜だけ整える」を押すと、その項目だけが変わります。
            </p>
          )}

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
              <p className="text-xs text-muted-foreground">{SCOPE_LABELS[doneScope ?? 'all']}</p>
              <p className="text-sm">{result.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                追加 {result.added} / 取り外し {result.removed} / 配置 {result.placed}
                {viewType === 'freeboard' && <> / 線 {result.connected}</>}
              </p>
              {/*
                気づいたこと。**1行ずつ立てて出す。**

                中身は3種類が混ざっている（AI が読んだ内容の誤り／図の辻褄の
                食い違い／重なりや交差といった崩れ）。つなげて1文にすると、
                どれが何件あるのかが読み取れない。
              */}
              {result.notes && (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">気づいたこと</p>
                  <ul className="space-y-0.5">
                    {result.notes.split('\n').filter(Boolean).map((note, index) => (
                      <li key={index} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                        <span aria-hidden>・</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
          <p className="text-2xs text-muted-foreground">{description}</p>
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
  /** hint は**選んでいるものの下にだけ**出す。全部に添えると、並びが説明文で埋まる */
  options: { value: string; label: string; hint?: string }[]
  value: string
  onChange: (value: string) => void
  disabled: boolean
  hint?: string
}) {
  const chosen = options.find((option) => option.value === value)

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
      {/* 選んでいるものの説明を優先する。呼び出し側の hint は、その次 */}
      {(chosen?.hint || hint) && (
        <p className="mt-1 text-2xs text-muted-foreground">{chosen?.hint || hint}</p>
      )}
    </div>
  )
}
