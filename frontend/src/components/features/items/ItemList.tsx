'use client'

import { startTransition, useEffect, useEffectEvent, useRef, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, X, Trash2, Check, CircleCheck, Circle, Tag as TagIcon, ShieldCheck, FileText, ChevronDown, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import {
  RegeneratingOverlay,
  REGENERATING_IMAGE_CLASS,
} from '@/components/features/items/RegeneratingOverlay'
import { SafeguardVeil, SAFEGUARD_IMAGE_CLASS } from '@/components/features/items/SafeguardVeil'
import { CardCreateButton } from '@/components/features/items/CardCreatePanel'
import { STATUS_LABEL, isRegenerating } from '@/lib/item-status'
import { usePendingRefresh } from '@/hooks/usePendingRefresh'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import {
  getItemsPage,
  getItemSuggestions,
  bulkDeleteItems,
  generateTags,
  generateMeaning,
  factCheckItem,
  retryItem,
  isItemSkip,
  type ItemSuggestion,
  type ItemOrSkip,
} from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import { useItemsStore } from '@/stores/items'
import type { Item } from '@/types/item'
import type { Tag } from '@/types/tag'
import { aspectRatioCss } from '@/lib/aspect-ratio'
import {
  useCardDisplay,
  CARD_GRID_CLASSES,
  cardsPerPage,
  cardImageSizes,
  type CardDisplay,
  type CardFit,
} from '@/hooks/useCardDisplay'
import { CardDisplayPanel } from '@/components/features/items/CardDisplayPanel'

// 一括AI操作の per-item 結果（完了後の確認ダイアログ用）
type BulkResultEntry = {
  id: string
  title: string
  outcome: 'processed' | 'skipped' | 'failed'
  item?: Item
  reason?: string
}

const SKIP_REASON_LABEL: Record<string, string> = {
  no_meaning: '説明が無いためスキップ',
  already_has_meaning: '既に説明があるためスキップ',
  already_tagged: '既にタグがあるためスキップ',
}

const FACT_CHECK_LABEL: Record<string, string> = {
  correct: '✓ 正しい',
  doubtful: '⚠ 疑わしい',
  incorrect: '✗ 誤り',
}

// 一括AI操作の種別。結果の表示（バッジ色・要点）を切り替えるのに使う。
type BulkKind = 'tag' | 'meaning' | 'factcheck' | 'regenerate'

// 結果バッジ（ラベル＋色）。ファクトチェックは判定（正しい/疑わしい/誤り）で色分けする。
function bulkBadge(kind: BulkKind, e: BulkResultEntry): { text: string; className: string } {
  const base = 'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium '
  if (e.outcome === 'failed') return { text: '失敗', className: base + 'bg-red-100 text-red-700' }
  if (e.outcome === 'skipped') return { text: 'スキップ', className: base + 'bg-muted text-muted-foreground' }
  // 再生成は送信しただけで、絵ができるのはこの後。「完了」と出すと誤解を招く
  if (kind === 'regenerate') return { text: '生成中', className: base + 'bg-blue-100 text-blue-700' }
  const status = kind === 'factcheck' ? e.item?.fact_check_status : undefined
  if (status) {
    const cls =
      status === 'correct' ? 'bg-green-100 text-green-700'
      : status === 'doubtful' ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-700'
    return { text: FACT_CHECK_LABEL[status] ?? '完了', className: base + cls }
  }
  return { text: '完了', className: base + 'bg-green-100 text-green-700' }
}

// 注意が必要な行（失敗・ファクトチェックで正しい以外）は左罫線＋淡い背景で強調する。
function bulkRowClass(kind: BulkKind, e: BulkResultEntry): string {
  if (e.outcome === 'failed') return 'border-l-2 border-l-red-400 bg-red-50/40'
  if (kind === 'factcheck') {
    const s = e.item?.fact_check_status
    if (s === 'incorrect') return 'border-l-2 border-l-red-400 bg-red-50/40'
    if (s === 'doubtful') return 'border-l-2 border-l-yellow-400 bg-yellow-50/50'
  }
  return ''
}

// アクション種別に応じて結果の要点テキストを返す。確認リストの説明用。
function bulkResultDetail(kind: BulkKind, e: BulkResultEntry): string | null {
  if (e.outcome === 'failed') return '生成に失敗しました（再試行できます）'
  if (e.outcome === 'skipped') return e.reason ? (SKIP_REASON_LABEL[e.reason] ?? 'スキップしました') : null
  const item = e.item
  if (!item) return null
  if (kind === 'factcheck') {
    const verdict = item.fact_check_status ? FACT_CHECK_LABEL[item.fact_check_status] : null
    if (!verdict) return null
    return item.fact_check_comment ? `${verdict} — ${item.fact_check_comment}` : verdict
  }
  if (kind === 'meaning') return item.meaning ?? null
  if (kind === 'tag') {
    const names = item.tags?.map((t) => t.name) ?? []
    return names.length ? `タグ: ${names.join(' / ')}` : 'タグなし'
  }
  return null
}

// 単語名の吹き出しの最大幅（max-w-[18rem] と合わせる）。寄せ方の判定に使う
const TITLE_TOOLTIP_MAX_WIDTH = 288

const TOOLTIP_ALIGN_CLASSES = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
} as const

// ファクトチェックで「正しい」以外のときの単語名の色（一覧カードで使用）。
// 人が読んで判断したもの（確認済み）は色を出さない。棚を開くたびに
// 解決済みの指摘で警告され続けるのは、警告そのものを読み飛ばす癖につながる。
function factCheckTitleClass(item: Item): string {
  if (item.fact_check_acknowledged_at) return ''
  if (item.fact_check_status === 'incorrect') return 'text-red-600'
  if (item.fact_check_status === 'doubtful') return 'text-yellow-700'
  return ''
}

function needsFactCheckAttention(item: Item): boolean {
  return Boolean(
    !item.fact_check_acknowledged_at && item.fact_check_status && item.fact_check_status !== 'correct'
  )
}


type ItemCardProps = {
  item: Item
  selectionMode: boolean
  selected: boolean
  onToggle: (id: string) => void
  fit: CardFit
  /** 列数から作った表示幅の申告。列を増やしたのに大きい画像を落とさないため */
  sizes: string
}

function ItemCard({ item, selectionMode, selected, onToggle, fit, sizes }: ItemCardProps) {
  const router = useRouter()
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const warmedRef = useRef(false)
  const imageUrl = item.media?.thumb_url ?? item.media?.url
  const resolvedImageUrl = imageUrl ?? null
  const hasImageError = resolvedImageUrl !== null && failedImageUrl === resolvedImageUrl
  // 前の画像が残ったまま生成中＝作り直し中。初回生成（画像が無い）とは見せ方を変える
  const regenerating = isRegenerating(item.generation_status, resolvedImageUrl !== null && !hasImageError)
  // 承認待ちは一覧でも覆う。ここで素の絵を出したら、覆う意味が無い。
  // 決めるのは詳細（カードをめくった先）で行う
  const veiled = Boolean(item.media?.needs_approval) && !regenerating

  // 単語名が枠に入り切らないときだけ、ホバーで全文を出す。
  // 列数を増やせるようにした結果、8〜10列では名前が数文字で切れる。
  // 切れていないカードにまで出すと、ただの邪魔になるので測ってから決める。
  //
  // 寄せ方も測って決める。真ん中から伸ばすと、左端・右端の列では棚の外へ出て切れる。
  // 段数は画面幅で変わる（xl で10列でも、md では5列）ので、何列目かは数えられない。
  // 棚そのものの左右端と見比べて、はみ出す側には付けない。
  const [tooltipAlign, setTooltipAlign] = useState<'left' | 'center' | 'right' | null>(null)

  const showTitleTooltip = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = e.currentTarget
    if (el.scrollWidth <= el.clientWidth) return setTooltipAlign(null)

    const grid = el.closest('[data-card-grid]')?.getBoundingClientRect()
    if (!grid) return setTooltipAlign('center')

    const card = el.getBoundingClientRect()
    const center = (card.left + card.right) / 2
    // 実際の幅は出してみないと分からないので、上限で見積もっておく（狭まるぶんには困らない）
    const half = TITLE_TOOLTIP_MAX_WIDTH / 2
    setTooltipAlign(center - half < grid.left ? 'left' : center + half > grid.right ? 'right' : 'center')
  }

  const warmupDetail = () => {
    if (warmedRef.current) return
    warmedRef.current = true

    startTransition(() => {
      useItemsStore.getState().upsertItem(item)
      router.prefetch(`/items/${item.id}`)
    })
  }

  const inner = (
    <>
      {/* テキストを上・画像を下に配置 */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        {/* ファクトチェックで「正しい」以外なら単語名に色を付けて気づけるようにする */}
        <span
          className={`text-sm font-medium truncate ${factCheckTitleClass(item)}`}
          title={needsFactCheckAttention(item) ? 'ファクトチェックで要確認' : undefined}
          onMouseEnter={showTitleTooltip}
          onMouseLeave={() => setTooltipAlign(null)}
        >
          {item.headline || item.title}
        </span>
        <StatusBadge status={item.generation_status} />
      </div>
      {/* 画像の周りに細い余白（マット）を入れ、トレーディングカードの縁に見せる。
          スキンやフレームを差し替えるときはこの枠を変える。

          そろえるときは枠を正方形に固定し、画像は縮めて全体を収める。台紙の余白が
          画像の周りに回るので、比率の違うカードが混ざっても棚が波打たない。
          画像側に w/h を張らないのは、張ると縁の影と線が画像ではなく余白の外周に付くため。 */}
      <div
        className="relative w-full bg-[color-mix(in_srgb,var(--card)_92%,var(--foreground))] p-[5%] flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: fit === 'uniform' ? '1 / 1' : aspectRatioCss(item.aspect_ratio) }}
      >
        {/* 丸型のチェックを画像の右上に。カードの上端はタイトルと状態バッジで
            埋まっているので、そこに重ねると読みたいものが隠れる。
            丸なのは、押して入り切りするつまみが一個だけだから */}
        {selectionMode && (
          <span
            aria-hidden
            className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
              selected
                ? 'border-[var(--palace)] bg-[var(--palace)] text-white'
                : 'border-white/90 bg-black/25 text-transparent'
            }`}
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
          >
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        {resolvedImageUrl && !hasImageError ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImageUrl}
              alt={item.title}
              className={`rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-black/15 ${
                fit === 'uniform' ? 'max-h-full max-w-full object-contain' : 'w-full h-full object-cover'
              } ${regenerating ? REGENERATING_IMAGE_CLASS : ''} ${veiled ? SAFEGUARD_IMAGE_CLASS : ''}`}
              loading="lazy"
              decoding="async"
              sizes={sizes}
              onError={() => setFailedImageUrl(resolvedImageUrl)}
            />
            {regenerating && <RegeneratingOverlay compact />}
            {veiled && <SafeguardVeil />}
          </>
        ) : (
          <GeneratingOverlay
            status={item.generation_status}
            label={hasImageError ? '期限切れ' : STATUS_LABEL[item.generation_status]}
            className="h-full w-full"
            textClassName="text-muted-foreground text-xs"
          />
        )}
      </div>

      {/* 名前と絵のほかに出す項目。値の無いものはサーバー側で落としてある。
          1行1項目で、長いものは省略する（1枚が縦に伸びると一覧が見渡せない） */}
      {(item.list_fields?.length ?? 0) > 0 && (
        <dl className="space-y-0.5 px-3 py-1.5">
          {item.list_fields!.map((field) => (
            <div key={field.key} className="flex gap-1.5 text-[11px] leading-snug">
              <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
              <dd className="truncate">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )

  // 選択モード中はナビゲーションせず、クリックで選択をトグルする
  const card = selectionMode ? (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={selected}
      className={`relative flex w-full flex-col rounded-xl border overflow-hidden bg-card text-left transition-shadow ${
        selected ? 'border-[var(--palace)] ring-2 ring-[var(--palace)]' : 'border-border hover:shadow-md'
      }`}
    >
      {inner}
    </button>
  ) : (
    <Link
      href={`/items/${item.id}`}
      className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
      prefetch
      onMouseEnter={warmupDetail}
      onFocus={warmupDetail}
    >
      {inner}
    </Link>
  )

  // 吹き出しはカードの外に置く。カード自身は overflow-hidden（画像を角丸で切るため）なので、
  // 中に置くと上へはみ出したぶんが切られる。
  //
  // 幅は中身なり（w-max）。折り返すのは、画面や隣のカードを押しのけるほど長いときだけ。
  return (
    <div className="relative flex flex-col">
      {tooltipAlign && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute bottom-full z-30 mb-1 w-max max-w-[min(18rem,80vw)] rounded-md bg-foreground px-2 py-1 text-xs leading-snug text-background shadow-md ${TOOLTIP_ALIGN_CLASSES[tooltipAlign]}`}
        >
          {item.headline || item.title}
        </span>
      )}
      {card}
    </div>
  )
}

export function ItemList({ initialTag = null }: { initialTag?: string | null }) {
  const router = useRouter()
  const items = useItemsStore((state) => state.items)
  const setItems = useItemsStore((state) => state.setItems)
  const removeItemFromStore = useItemsStore((state) => state.removeItem)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(() => useItemsStore.getState().items.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(initialTag)
  const [sortKey, setSortKey] = useState('created_at:desc')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([])
  const [suggestFocused, setSuggestFocused] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(true)
  const [activeIndex, setActiveIndex] = useState(-1)
  const requestInFlightRef = useRef(false)

  // 選択モード・一括削除
  const [selectionMode, setSelectionMode] = useState(false)
  // 一覧の見え方（画像の収め方・1行の枚数・1ページの枚数）。端末ごとに覚える
  const [display, setDisplay] = useCardDisplay()

  // 1ページの枚数（列数×行数）が変わったら先頭へ戻す。5ページ目のまま増やすと、
  // そのページ自体が無くなって空の棚が出る
  const changeDisplay = (patch: Partial<CardDisplay>) => {
    const changesCount =
      (patch.columns !== undefined && patch.columns !== display.columns) ||
      (patch.rows !== undefined && patch.rows !== display.rows)
    if (changesCount) setPage(1)
    setDisplay(patch)
  }
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  // 一括AI操作（タグ再設定・付与・ファクトチェック・説明付与）の進捗とサマリ
  const [bulkAction, setBulkAction] = useState<{ label: string; done: number; total: number } | null>(null)
  const [bulkSummary, setBulkSummary] = useState<string | null>(null)
  // 完了後に確認できる per-item 結果
  const [bulkResults, setBulkResults] = useState<{ kind: BulkKind; entries: BulkResultEntry[] } | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)
  // 上書き系の確認。{ 見出し, 説明, 実行 } を持ち、確認バーから実行する
  const [pendingBulk, setPendingBulk] = useState<{ title: string; detail: string; run: () => void } | null>(null)
  const askBulk = (title: string, detail: string, run: () => void) => {
    if (selectedIds.size === 0) return
    setActionError(null)
    setPendingBulk({ title, detail, run })
  }
  const cancelBulkRef = useRef(false)
  const upsertItem = useItemsStore((state) => state.upsertItem)
  const bulkBusy = deleting || bulkAction !== null

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setPendingBulk(null)
    setActionError(null)
    setBulkSummary(null)
    setBulkResults(null)
    setResultsOpen(false)
  }

  // 選択カードを1件ずつ AI 操作に通す共通ループ。進捗を出し、スキップ/失敗を集計する。
  const runBulkAi = async (
    label: string,
    kind: BulkKind,
    fn: (id: string) => Promise<ItemOrSkip>,
    // 選択の一部だけを対象にするとき（例: 失敗したものだけ作り直す）
    include?: (id: string) => boolean
  ) => {
    const ids = [...selectedIds].filter((id) => !include || include(id))
    if (ids.length === 0) return
    cancelBulkRef.current = false
    setActionError(null)
    setBulkSummary(null)
    setBulkResults(null)
    setResultsOpen(false)
    setBulkAction({ label, done: 0, total: ids.length })

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const titleOf = (id: string) => items.find((it) => it.id === id)?.title ?? id
    const entries: BulkResultEntry[] = []
    let processed = 0
    let skipped = 0
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      if (cancelBulkRef.current) break
      let attempt = 0
      // レート制限（429）は待って再試行し、取りこぼさない
      for (;;) {
        try {
          const result = await fn(ids[i])
          if (isItemSkip(result)) {
            skipped += 1
            entries.push({ id: ids[i], title: titleOf(ids[i]), outcome: 'skipped', reason: result.reason })
          } else {
            upsertItem(result)
            processed += 1
            entries.push({ id: ids[i], title: result.title, outcome: 'processed', item: result })
          }
          break
        } catch (err) {
          const res = (err as { response?: { status?: number; headers?: Record<string, string> } }).response
          if (res?.status === 429 && attempt < 30 && !cancelBulkRef.current) {
            attempt += 1
            const retryAfter = Number(res.headers?.['retry-after']) || 5
            setBulkAction({ label: `${label}（混雑のため待機中）`, done: i, total: ids.length })
            await sleep(Math.min(retryAfter, 60) * 1000)
            if (cancelBulkRef.current) break
            continue
          }
          failed += 1
          entries.push({ id: ids[i], title: titleOf(ids[i]), outcome: 'failed' })
          break
        }
      }
      setBulkAction({ label, done: i + 1, total: ids.length })
    }

    setBulkAction(null)
    const parts = [`${processed}件処理`]
    if (skipped) parts.push(`${skipped}件スキップ`)
    if (failed) parts.push(`${failed}件失敗`)
    if (cancelBulkRef.current) parts.push('中断')
    setBulkSummary(`${label}: ${parts.join(' / ')}`)
    if (entries.length > 0) setBulkResults({ kind, entries })
  }

  // ── 一括操作 ────────────────────────────────────────────────
  // 上書き系（作り直す）は取り消せないので、実行前に確認バーを出す。
  // 確認の作法をメニュー3つで揃えるため、pendingBulk に集約している。
  const handleTagFill = () => runBulkAi('タグを付与', 'tag', (id) => generateTags(id, { onlyIfEmpty: true }))
  const handleMeaningFill = () =>
    runBulkAi('説明を付与', 'meaning', (id) => generateMeaning(id, undefined, { onlyIfEmpty: true }))
  const handleFactCheck = () => runBulkAi('説明のAIチェック', 'factcheck', (id) => factCheckItem(id))

  const handleTagReplace = () =>
    askBulk('タグをすべて作り直す', `選択 ${selectedIds.size} 件のタグをAIの結果で置き換えます`, () =>
      runBulkAi('タグを作り直す', 'tag', (id) => generateTags(id, { replace: true }))
    )

  const handleMeaningReplace = () =>
    askBulk('説明をすべて作り直す', `選択 ${selectedIds.size} 件の説明をAIの結果で置き換えます`, () =>
      runBulkAi('説明を作り直す', 'meaning', (id) => generateMeaning(id))
    )

  // 画像は1枚につき1クレジット。失敗したものだけに絞れると、成功済みのぶんを無駄にしない
  const regenerateTargets = (failedOnly: boolean) =>
    [...selectedIds].filter((id) => !failedOnly || items.find((it) => it.id === id)?.generation_status === 'failed')

  const handleRegenerate = (failedOnly: boolean) => {
    const targets = new Set(regenerateTargets(failedOnly))
    if (targets.size === 0) {
      setActionError(failedOnly ? '選択の中に失敗したカードはありません' : 'カードを選んでください')
      return
    }
    askBulk(
      failedOnly ? '失敗した画像を作り直す' : '画像をすべて作り直す',
      `${targets.size} 件を作り直します（${targets.size} クレジット使います）`,
      () => runBulkAi('画像を作り直す', 'regenerate', (id) => retryItem(id), (id) => targets.has(id))
    )
  }

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return }

    const ids = [...selectedIds]
    setDeleting(true)
    setActionError(null)
    try {
      const deleted = await bulkDeleteItems(ids)
      deleted.forEach(removeItemFromStore)
      exitSelection()
      setRefreshToken((t) => t + 1)
    } catch {
      setActionError('カードの削除に失敗しました。もう一度お試しください。')
      setConfirmBulkDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  // 入力をデバウンスして検索に反映（変更時は1ページ目に戻す）
  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  // オートコンプリート候補（軽量サジェスト・短めのデバウンス）
  useEffect(() => {
    const q = query.trim()
    const handle = setTimeout(() => {
      if (!q) { setSuggestions([]); return }
      getItemSuggestions(q).then(setSuggestions).catch(() => setSuggestions([]))
    }, 180)
    return () => clearTimeout(handle)
  }, [query])

  const showSuggestions = suggestFocused && suggestOpen && suggestions.length > 0

  const goToSuggestion = (s: ItemSuggestion) => {
    setSuggestOpen(false)
    router.push(`/items/${s.id}`)
  }

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        goToSuggestion(suggestions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false)
    }
  }

  // タグ一覧（絞り込みチップ用）
  useEffect(() => {
    let cancelled = false
    getTags()
      .then((data) => {
        if (!cancelled) setTags(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // 現在ページを取得し、ストア（＝詳細画面の前後ナビが参照）へ反映する
  const fetchPage = useEffectEvent(async (targetPage: number): Promise<Item[] | null> => {
    if (requestInFlightRef.current) return null

    requestInFlightRef.current = true
    try {
      const [sort, direction] = sortKey.split(':')
      const { items: fetched, meta } = await getItemsPage(targetPage, cardsPerPage(display), {
        tagId: activeTag ?? undefined,
        query: appliedQuery || undefined,
        sort,
        direction,
        status: statusFilter || undefined,
      })
      setItems(fetched)
      setTotalPages(Math.max(meta.total_pages, 1))
      setError(null)
      return fetched
    } catch {
      setError('カードの取得に失敗しました')
      return null
    } finally {
      requestInFlightRef.current = false
    }
  })

  const selectTag = (tagId: string | null) => {
    if (tagId === activeTag) return
    setLoading(true)
    setActiveTag(tagId)
    setPage(1)
  }

  const changeSort = (value: string) => {
    if (value === sortKey) return
    setLoading(true)
    setSortKey(value)
    setPage(1)
  }

  const changeStatus = (value: string) => {
    if (value === statusFilter) return
    setLoading(true)
    setStatusFilter(value)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false

    setLoading(true)

    // 取得は 1 回だけ。生成中を追いかけるのは usePendingRefresh に任せる。
    // ここで自前に繰り返すと、取得時点で生成中が居なかった場合に起動せず、
    // 後からパネルで作られたカードの完成を拾えない。
    const poll = async () => {
      await fetchPage(page)
    }

    poll().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [page, activeTag, appliedQuery, sortKey, statusFilter, refreshToken, display.columns, display.rows])

  /*
    生成中のカードがある間だけ取り直す。
    パネルで作られたカードもストアへ入るので、ここが拾って完成を反映する。
  */
  // 取得そのものは効果の中で行う決まりなので、印を進めて効果を動かす
  const refreshCurrentPage = useCallback(() => {
    setRefreshToken((token) => token + 1)
  }, [])
  usePendingRefresh(items, refreshCurrentPage)

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages || next === page) return
    setPage(next)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const chipBase = 'rounded-full px-3 py-1 text-sm whitespace-nowrap transition-colors border'
  const tagFilter = tags.length > 0 ? (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => selectTag(null)}
        className={activeTag === null ? `${chipBase} border-transparent text-white` : `${chipBase} border-border text-muted-foreground hover:bg-muted`}
        style={activeTag === null ? { backgroundColor: 'var(--palace)' } : undefined}
      >
        すべて
      </button>
      {tags.map((tag) => {
        const active = activeTag === tag.id
        return (
          <button
            key={tag.id}
            onClick={() => selectTag(tag.id)}
            className={active ? `${chipBase} border-transparent text-white` : `${chipBase} border-border text-muted-foreground hover:bg-muted`}
            style={active ? { backgroundColor: 'var(--palace)' } : undefined}
          >
            {tag.name}（{tag.item_count}）
          </button>
        )
      })}
    </div>
  ) : null

  const searchBox = (
    <div className="relative min-w-[200px] flex-1">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); setActiveIndex(-1) }}
        onFocus={() => setSuggestFocused(true)}
        onBlur={() => setSuggestFocused(false)}
        onKeyDown={onSearchKeyDown}
        placeholder="カードを検索（単語名）"
        aria-label="カード検索"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls="card-suggestions"
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full rounded-lg border border-input bg-background pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setSuggestions([]) }}
          aria-label="検索をクリア"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X size={15} />
        </button>
      )}
      {showSuggestions && (
        <ul
          id="card-suggestions"
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); goToSuggestion(s) }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === activeIndex ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Search size={14} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const sortFilterControls = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sortKey}
        onChange={(e) => changeSort(e.target.value)}
        aria-label="並び替え"
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="created_at:desc">新しい順</option>
        <option value="created_at:asc">古い順</option>
        <option value="title:asc">名前順（あ→ん）</option>
        <option value="title:desc">名前順（ん→あ）</option>
      </select>
      <select
        value={statusFilter}
        onChange={(e) => changeStatus(e.target.value)}
        aria-label="ステータスで絞り込み"
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">すべての状態</option>
        <option value="completed">完了</option>
        <option value="processing">生成中</option>
        <option value="pending">生成待ち</option>
        <option value="failed">失敗</option>
        <option value="needs_correction">訂正待ち（要確認）</option>
      </select>
    </div>
  )

  const filterBar = (
    <div className="space-y-3">
      {/* 検索バー（伸縮）＋ソート/絞り込みプルダウンを1行に収める。狭い幅では折り返す。 */}
      <div className="flex flex-wrap items-center gap-2">
        {searchBox}
        {sortFilterControls}
      </div>
      {tagFilter}
    </div>
  )

  // 一覧に対する操作をまとめた列。見出しの行は「ここが何の一覧か」だけにして、
  // 押せるものはこちらへ集める。
  //
  // 作成は絞り込みの結果が0件でも押せるようにする（見出しから外したので、
  // ここに出さないと「該当なし」の画面から作りに行けなくなる）。
  // 選択は並んでいるものに対する操作なので、0件のときは出さない。
  const toolbar = (
    <div className="flex justify-end gap-2">
      {/* 並びは [選択][表示][作成]。選択は左を使い切り、
          #450 で決めたとおり「作成」を右端に据え置く。
          選択モードに入っても押せるものの位置が変わらない。 */}
      {items.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
          <CircleCheck size={14} className="mr-1" />
          選択
        </Button>
      )}
      <CardDisplayPanel display={display} onChange={changeDisplay} />
      <CardCreateButton />
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {filterBar}
        {/* 読み込み中の格子を本番と揃える。既定の5列8枚で描くと、
            10列25枚にしている人は一度組み替わる画面を見ることになる */}
        <CardGridSkeleton withTitle columns={display.columns} count={cardsPerPage(display)} />
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (items.length === 0) {
    if (activeTag || appliedQuery || statusFilter) {
      return (
        <div className="space-y-6">
          {filterBar}
          {toolbar}
          <p className="text-center text-muted-foreground py-12">
            {appliedQuery
              ? `「${appliedQuery}」に一致するカードはありません。`
              : statusFilter
                ? 'この条件のカードはありません。'
                : 'このタグのカードはありません。'}
          </p>
        </div>
      )
    }
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">まだカードがありません。単語を入れて、最初の記憶カードを作りましょう。</p>
        <div className="mx-auto max-w-md rounded-xl border border-border/70 bg-muted/40 px-4 py-4 text-left">
          <p className="text-sm font-medium">最初に試しやすい例</p>
          <p className="mt-2 text-sm text-muted-foreground">富士山、光合成、API、細胞分裂</p>
          <p className="mt-1 text-xs text-muted-foreground">具体的な単語から始めると、画像生成が安定しやすいです。</p>
        </div>
        <Link href="/items/new">
          <Button>カードを作成する</Button>
        </Link>
      </div>
    )
  }

  const selectionBar = !selectionMode ? (
    toolbar
  ) : (
    <div className="space-y-2">
      {/* 操作盤が広がるのは「選択」が置かれていた場所から左だけ。
          「表示」「作成」は選択中も同じ位置に残す。モードを切り替えた瞬間に
          押せるものが動くと、次に押したいものを目で探し直すことになる。

          押す前と縦幅も揃える。行が伸びると下の棚がずれて、いま見ていたカードを
          目で追い直すことになる。そのため枠の上下余白と枠線は持たせず（背景だけで
          モードを示す）、入り切らないぶんは折り返さずに横へ流す。 */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-muted/40 px-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={bulkBusy}
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {allSelected ? <CircleCheck size={16} /> : <Circle size={16} />}
            {allSelected ? 'すべて解除' : 'すべて選択'}
          </button>
          <span className="shrink-0 text-sm text-muted-foreground">{selectedIds.size}件を選択中</span>
          <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto">
            {/*
              対象（タグ・説明・画像）ごとに1つの入口へまとめる。
              「未設定だけ埋める」と「すべて上書き」は結果が全く違うので、同じボタンには載せず
              メニュー内の別項目にする。上書き側は取り消せないため一段深い位置に置く。
            */}
            <BulkMenu label="タグ" icon={<TagIcon size={14} />} disabled={bulkBusy || selectedIds.size === 0}>
              <DropdownMenuLabel>選択 {selectedIds.size} 件のタグ</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleTagFill}>
                未設定だけ付ける
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleTagReplace} variant="destructive">
                すべて作り直す（上書き）
              </DropdownMenuItem>
            </BulkMenu>

            <BulkMenu label="説明" icon={<FileText size={14} />} disabled={bulkBusy || selectedIds.size === 0}>
              <DropdownMenuLabel>選択 {selectedIds.size} 件の説明</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleMeaningFill}>
                未設定だけ付ける
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleMeaningReplace} variant="destructive">
                すべて作り直す（上書き）
              </DropdownMenuItem>
            </BulkMenu>

            <BulkMenu label="画像" icon={<ImageIcon size={14} />} disabled={bulkBusy || selectedIds.size === 0}>
              <DropdownMenuLabel>選択 {selectedIds.size} 件の画像</DropdownMenuLabel>
              {/* 失敗したものだけ作り直せると、成功済みのぶんのクレジットを無駄にしない */}
              <DropdownMenuItem onSelect={() => handleRegenerate(true)}>
                失敗したものだけ作り直す
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleRegenerate(false)} variant="destructive">
                すべて作り直す（{selectedIds.size} cr）
              </DropdownMenuItem>
            </BulkMenu>

            <Button variant="outline" size="sm" onClick={handleFactCheck} disabled={bulkBusy || selectedIds.size === 0}
              className="flex shrink-0 items-center gap-1.5" title="説明が事実として正しいかAIでチェックし、訂正案を出します">
              <ShieldCheck size={14} />説明のAIチェック
            </Button>
            <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
            <Button
              variant={confirmBulkDelete ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkBusy || selectedIds.size === 0}
              onBlur={() => setConfirmBulkDelete(false)}
              className="flex shrink-0 items-center gap-1.5"
            >
              {deleting ? <Spinner size={14} /> : <Trash2 size={14} />}
              {deleting ? '削除中...' : confirmBulkDelete ? `本当に削除（${selectedIds.size}件）` : '削除'}
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={exitSelection} disabled={bulkBusy}>
              キャンセル
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CardDisplayPanel display={display} onChange={changeDisplay} />
          <CardCreateButton />
        </div>
      </div>
      {pendingBulk && !bulkAction && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{pendingBulk.title}</p>
            <p className="text-xs text-muted-foreground">{pendingBulk.detail}・元には戻せません</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const run = pendingBulk.run
                setPendingBulk(null)
                run()
              }}
            >
              実行する
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingBulk(null)}>
              やめる
            </Button>
          </div>
        </div>
      )}
      {bulkAction && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} />
          {bulkAction.label}中... ({bulkAction.done}/{bulkAction.total})
          <button
            type="button"
            onClick={() => { cancelBulkRef.current = true }}
            className="underline hover:text-foreground"
          >
            中断
          </button>
        </div>
      )}
      {bulkSummary && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{bulkSummary}</span>
            {bulkResults && bulkResults.entries.length > 0 && (
              <button
                type="button"
                onClick={() => setResultsOpen((v) => !v)}
                className="underline hover:text-foreground"
              >
                {resultsOpen ? '結果を閉じる' : '結果を確認'}
              </button>
            )}
          </div>
          {resultsOpen && bulkResults && (
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border border-border bg-card">
              {bulkResults.entries.map((e) => {
                const detail = bulkResultDetail(bulkResults.kind, e)
                const badge = bulkBadge(bulkResults.kind, e)
                return (
                  <li key={e.id} className={`px-3 py-2 ${bulkRowClass(bulkResults.kind, e)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/items/${e.id}`} className="text-sm font-medium hover:underline">
                        {e.title}
                      </Link>
                      <span className={badge.className}>{badge.text}</span>
                    </div>
                    {detail && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{detail}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      {filterBar}
      {selectionBar}
      <div data-card-grid className={`grid gap-4 ${CARD_GRID_CLASSES[display.columns]}`}>
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onToggle={toggleSelect}
            fit={display.fit}
            sizes={cardImageSizes(display.columns)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-4" aria-label="ページネーション">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            前へ
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums" aria-current="page">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1"
          >
            次へ
            <ChevronRight size={16} />
          </Button>
        </nav>
      )}
    </div>
  )
}

/**
 * 一括操作の入口。対象（タグ・説明・画像）ごとに1つ置き、動作はメニュー内で選ぶ。
 * ボタンを動作の数だけ並べると横に溢れ、上書き系を押し間違えやすくなるため。
 */
function BulkMenu({
  label,
  icon,
  disabled,
  children,
}: {
  label: string
  icon: ReactNode
  disabled: boolean
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      {/* Base UI の Trigger は自前で要素を描くので、隣のボタンと同じ見た目を直接あてる */}
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        {icon}
        {label}
        <ChevronDown size={13} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
