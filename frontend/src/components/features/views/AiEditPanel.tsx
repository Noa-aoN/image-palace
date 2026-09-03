'use client'

import { useState, type ReactNode } from 'react'
import { Wand2, Undo2, Redo2, ChevronDown } from 'lucide-react'
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

/**
 * どこまで整えるか。
 *
 * 以前は「カードだけ」「線だけ」「配置だけ」「文言だけ」「すべて」の
 * **5つの実行ボタン**で範囲を決めていた。押した場所で範囲が決まる仕掛けは巧いが、
 * 別に選んだ設定と噛み合わず、**選んだはずのものが黙って無視される**ことがあった。
 *
 * 実行ボタンは1つにして、範囲は明示的に選ぶ形にする。
 */
type PanelScope = 'all' | 'layout' | 'edges'

const SCOPE_CHOICES: { value: PanelScope; label: string; hint: string }[] = [
  { value: 'all', label: '置き方と線', hint: 'カードの並びと、つなぎ方の両方を整えます' },
  { value: 'layout', label: '置き方だけ', hint: '線はそのままにして、並びだけ整えます' },
  { value: 'edges', label: '線だけ', hint: '置き場所は動かさず、つなぎ方だけ整えます' },
]

/** 線の扱い。**「文字だけ」は線の中の話**なので、ここに含める */
const EDGE_CHOICES: { value: AiEditEdgeMode; label: string; hint: string }[] = [
  { value: 'rebuild', label: '引き直す', hint: '指示に沿って、線を引き直します' },
  { value: 'infer', label: '意味から見つける', hint: '書かれていない関係も、意味を読んで結びます' },
  { value: 'relabel', label: '文字だけ直す', hint: 'つなぎ方は変えず、線の上の言葉だけ当て直します' },
  { value: 'keep', label: '触らない', hint: 'いまの線をそのままにします' },
]

/** どれだけ動かしてよいか。「いまの形を活かす」をここへ吸収する */
const CHANGE_SCALES: { value: AiEditChangeScale; label: string; hint: string }[] = [
  { value: 'small', label: '控えめ', hint: 'いまの形をできるだけ残します' },
  { value: 'medium', label: 'ふつう', hint: '読みやすさといまの形の釣り合いを取ります' },
  { value: 'large', label: '大胆に', hint: '読みやすさを優先して並べ直します' },
]

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
  const [direction, setDirection] = useState<AiEditDirection>('auto')
  const [changeScale, setChangeScale] = useState<AiEditChangeScale>('medium')
  const [editScope, setEditScope] = useState<PanelScope>('all')
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
  const canRun = busy === null && (!needsInstruction || instruction.trim().length > 0)

  /**
   * 選んだ範囲を、サーバへ渡す形にする。
   *
   * **範囲の外は必ず「触らない」にする。** そう伝えないと既定が効いてしまい、
   * 「線だけ整えて」と言ったのにカードが動く、ということが起きる。
   */
  const optionsFor = () => {
    const touchesLayout = editScope !== 'edges'
    const touchesEdges = editScope !== 'layout'

    return {
      layout,
      placement: touchesLayout ? ('arrange' as const) : ('keep' as const),
      direction: touchesLayout ? direction : undefined,
      change_scale: touchesLayout ? changeScale : undefined,
      edges: touchesEdges ? edgeMode : ('keep' as const),
      // 大きさは置き方の一部として扱う。別の軸にすると、
      // 「置き方だけ整える」で大きさが揃わない理由が読めない
      sizing: touchesLayout ? ('ai' as const) : ('keep' as const),
    }
  }

  /**
   * 整える。**入口はここ1つ。**
   *
   * 範囲別に5つのボタンを置いていた頃は、押した場所で決まる範囲と、
   * 別に選んだ設定とが噛み合わず、選んだはずのものが黙って無視されていた。
   */
  const run = async () => {
    if (busy) return
    // カードを足す2つの方針は、提案→承認を挟む
    if (mode === 'create') return propose('create')
    if (mode === 'select') return propose('select')

    // 空欄でよい。**サーバーがボードの名前を指示にする**
    setBusy('edit')
    setError(null)
    setResult(null)
    try {
      const updated = await aiEditView(viewId, instruction.trim(), 'placed_only', optionsFor())
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
            **ふだんは、指示欄と「整える」だけ。**

            以前は選択肢と実行ボタンが 30 個ほど並んでいた。
            「何を編集するか」「どう編集するか」「どこまで変えてよいか」が
            混ざったまま、全部が同じ高さで並んでいたので、
            **どれを押せばよいのかが読み取れなかった。**

            内部が緻密になるほど、表に出す操作は減らせる。
            既定のまま押して良い図が出ることを目標に置き、
            細かい指定は「詳しく」の中へ畳む。
          */}
          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              詳しく
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-5 border-t border-border px-3 py-4">
              {/* ① 何を触るか。**カード本文には触らない**ので、そう書いておく */}
              <Choice
                label="どこまで整えるか"
                options={SCOPE_CHOICES}
                value={editScope}
                onChange={(value) => setEditScope(value as PanelScope)}
                disabled={busy !== null}
              />
              <p className="text-2xs text-muted-foreground">
                カードの見出しや説明そのものは変えません。ボード上での置き方と、線だけを整えます。
              </p>

              {/* ② 図の形。置き場所を触るときだけ意味がある */}
              {viewType === 'freeboard' && editScope !== 'edges' && (
                <>
                  <Choice
                    label="図の形"
                    options={LAYOUTS}
                    value={layout}
                    onChange={(value) => setLayout(value as AiEditLayout)}
                    disabled={busy !== null}
                  />
                  <Choice
                    label="流れの向き"
                    options={DIRECTIONS}
                    value={direction}
                    onChange={(value) => setDirection(value as AiEditDirection)}
                    disabled={busy !== null}
                  />
                  <Choice
                    label="変更量"
                    options={CHANGE_SCALES}
                    value={changeScale}
                    onChange={(value) => setChangeScale(value as AiEditChangeScale)}
                    disabled={busy !== null}
                  />
                </>
              )}

              {/* ③ 線の扱い。置き場所だけ整えるときは出さない */}
              {viewType === 'freeboard' && editScope !== 'layout' && (
                <Choice
                  label="線"
                  options={EDGE_CHOICES}
                  value={edgeMode}
                  onChange={(value) => setEdgeMode(value as AiEditEdgeMode)}
                  disabled={busy !== null}
                />
              )}

              {/* ④ カードを足すか。**足すときだけ指示が要る**ので、最後に置く */}
              <Choice
                label="カードを足すか"
                options={MODES.map((option) => ({
                  value: option.value,
                  label: option.label,
                  hint: option.description,
                }))}
                value={mode}
                onChange={(value) => setMode(value as EditChoice)}
                disabled={busy !== null}
              />
            </div>
          </details>

          {/* 押すところは1つ。**何が変わるかは「詳しく」で決まっている** */}
          <Button
            onClick={() => run()}
            disabled={!canRun}
            className="flex w-full items-center justify-center gap-1.5"
          >
            {busy === 'edit' || busy === 'propose' ? <Spinner size={14} /> : <Wand2 size={14} />}
            {runLabel(mode, busy, editScope)}
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

/**
 * ボタンに出す言葉。**いま何が起きるかを、押す前に言う。**
 *
 * 「詳しく」を畳んでいると、選んだ範囲が画面から見えなくなる。
 * ボタンに書けば、開かなくても分かる。
 */
function runLabel(mode: EditChoice, busy: string | null, scope: PanelScope): string {
  if (mode === 'create') return busy === 'propose' ? '考え中…' : '作るカードを提案してもらう'
  if (mode === 'select') return busy === 'propose' ? '考え中…' : '足すカードを提案してもらう'
  if (busy === 'edit') return '整えています…'

  if (scope === 'layout') return '置き方を整える'
  if (scope === 'edges') return '線を整える'
  return '整える'
}
