'use client'

import { useEffect, useEffectEvent, useRef, useState, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, X, Trash2, Check, CircleCheck, Circle, Tag as TagIcon, Pin, ShieldCheck, FileText, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { shouldShowSkeleton } from '@/lib/items/list-loading'
import { CardCreateButton } from '@/components/features/items/CardCreatePanel'
import { getItemTypes } from '@/lib/api/items'
import { usePendingRefresh } from '@/hooks/usePendingRefresh'
import { ItemCard } from '@/components/features/items/ItemCard'
import {
  getItemsPage,
  getItemSuggestions,
  bulkDeleteItems,
  factCheckItem,
  imageCheckItem,
  retryItem,
  getItem,
  isItemSkip,
  type ItemSuggestion,
  type ItemOrSkip,
} from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import { fillItemProperties } from '@/lib/api/properties'
import { useFeatureStage } from '@/stores/features'
import { BulkPropertyPicker, BULK_PROPERTY_PANEL_KEY } from '@/components/features/items/BulkPropertyPicker'
import { BulkUsePanel, BULK_USE_PANEL_KEY } from '@/components/features/items/BulkUsePanel'
import type { BulkUseFamily } from '@/components/features/items/BulkUsePanel'
import { useRightPanelStore } from '@/stores/rightPanel'
import { useItemsStore } from '@/stores/items'
import type { Item, ItemType } from '@/types/item'
import type { Tag } from '@/types/tag'
import { aspectRatioCss } from '@/lib/aspect-ratio'
import { densityFor } from '@/lib/items/card-density'
import {
  useCardDisplay,
  CARD_GRID_CLASSES,
  cardsPerPage,
  cardImageSizes,
  type CardDisplay,
} from '@/hooks/useCardDisplay'
import { CardDisplayPanel } from '@/components/features/items/CardDisplayPanel'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CREDIT_UNIT_SHORT, CREDIT_VALIDITY_LABEL } from '@/lib/billing'

// 一括AI操作の per-item 結果（完了後の確認ダイアログ用）
type BulkResultEntry = {
  id: string
  title: string
  outcome: 'processed' | 'skipped' | 'failed'
  item?: Item
  reason?: string
  /** そのカードで何が起きたか。**操作ごとに違う**ので、実行した側が書く */
  note?: string
}

// カードの上に出す「いま何をしているか」。
//
// 一覧の見出し（「タグを作り直す」など）をそのまま繋ぐと
// 「タグを作り直す中」になってしまうので、札に出す言い方は別に持つ。
// 種別から引くので、操作が増えても言い方がばらけない
const BULK_BUSY_LABEL: Record<string, string> = {
  tag: 'タグ付け',
  meaning: '説明づくり',
  property: '項目を埋め中',
  factcheck: 'AIチェック',
  imagecheck: 'イメージ点検',
  regenerate: '作り直し',
}

const SKIP_REASON_LABEL: Record<string, string> = {
  no_meaning: '説明が無いためスキップ',
  no_image: '絵が無いためスキップ',
  already_has_meaning: '既に説明があるためスキップ',
  already_tagged: '既にタグがあるためスキップ',
}

/** 絵と語の噛み合い。**説明の判定とは別の並び**にする（見ているものが違う） */
const IMAGE_CHECK_LABEL: Record<string, string> = {
  fits: '✓ 合っている',
  weak: '⚠ 思い出しにくい',
  mismatch: '✕ 別のものの絵',
}

const FACT_CHECK_LABEL: Record<string, string> = {
  correct: '✓ 正しい',
  doubtful: '⚠ 疑わしい',
  incorrect: '✗ 誤り',
}

// 一括AI操作の種別。結果の表示（バッジ色・要点）を切り替えるのに使う。
type BulkKind = 'tag' | 'meaning' | 'property' | 'factcheck' | 'imagecheck' | 'regenerate'

// 結果バッジ（ラベル＋色）。ファクトチェックは判定（正しい/疑わしい/誤り）で色分けする。
function bulkBadge(kind: BulkKind, e: BulkResultEntry): { text: string; className: string } {
  const base = 'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium '
  if (e.outcome === 'failed') return { text: '失敗', className: base + 'bg-red-100 text-red-700' }
  if (e.outcome === 'skipped') return { text: 'スキップ', className: base + 'bg-muted text-muted-foreground' }
  // 再生成は送信しただけで、絵ができるのはこの後。「完了」と出すと誤解を招く
  if (kind === 'regenerate') return { text: '生成中', className: base + 'bg-blue-100 text-blue-700' }
  // 絵の点検も、判定で色を分ける（説明の判定とは別の言い方にする）
  if (kind === 'imagecheck') {
    const fit = e.item?.image_check_status
    if (fit) {
      const cls =
        fit === 'fits' ? 'bg-green-100 text-green-700'
        : fit === 'weak' ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-700'
      return { text: IMAGE_CHECK_LABEL[fit] ?? '完了', className: base + cls }
    }
  }
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
  if (kind === 'imagecheck') {
    const fit = e.item?.image_check_status
    if (fit === 'mismatch') return 'border-l-2 border-l-red-400 bg-red-50/40'
    if (fit === 'weak') return 'border-l-2 border-l-yellow-400 bg-yellow-50/50'
  }
  return ''
}

// アクション種別に応じて結果の要点テキストを返す。確認リストの説明用。
function bulkResultDetail(kind: BulkKind, e: BulkResultEntry): string | null {
  if (e.outcome === 'failed') return '生成に失敗しました（再試行できます）'
  if (e.outcome === 'skipped') return e.reason ? (SKIP_REASON_LABEL[e.reason] ?? 'スキップしました') : null

  const item = e.item
  const base = !item ? null
    : kind === 'imagecheck' ? imageCheckDetail(item)
    : kind === 'factcheck' ? factCheckDetail(item)
    : kind === 'meaning' ? (item.meaning ?? null)
    : kind === 'tag' ? tagDetail(item)
    : null

  // 実行した側が書き残した一言（何を書いたか・何を見たか）は、
  // **判定を置き換えずに添える**。片方だけでは、結果を読み切れない
  if (!e.note) return base
  return base ? `${base}（${e.note}）` : e.note
}

function imageCheckDetail(item: Item): string | null {
  const verdict = item.image_check_status ? IMAGE_CHECK_LABEL[item.image_check_status] : null
  if (!verdict) return null
  return item.image_check_comment ? `${verdict} — ${item.image_check_comment}` : verdict
}

function factCheckDetail(item: Item): string | null {
  const verdict = item.fact_check_status ? FACT_CHECK_LABEL[item.fact_check_status] : null
  if (!verdict) return null
  return item.fact_check_comment ? `${verdict} — ${item.fact_check_comment}` : verdict
}

function tagDetail(item: Item): string {
  const names = item.tags?.map((t) => t.name) ?? []
  return names.length ? `タグ: ${names.join(' / ')}` : 'タグなし'
}

// タグだけでなく種別も入るので、鍵と名前は「絞り込み」に寄せる
const FILTER_PANEL_KEY = 'items-filter'

export function ItemList({ initialTag = null }: { initialTag?: string | null }) {
  const tagPanel = usePanelForm(FILTER_PANEL_KEY, '絞り込む')
  const router = useRouter()
  const items = useItemsStore((state) => state.items)
  const setItems = useItemsStore((state) => state.setItems)
  const removeItemFromStore = useItemsStore((state) => state.removeItem)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(() => useItemsStore.getState().items.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  // タグを引き終えたか。引き終える前は「タグが無い」と区別が付かないので、
  // これを見て場所だけ先に空けておく（あとから現れると行が組み替わる）
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  // タグは複数選べる。選ぶほど狭くなる（サーバー側はすべてを持つものだけを返す）
  const [activeTags, setActiveTags] = useState<string[]>(initialTag ? [ initialTag ] : [])
  const [sortKey, setSortKey] = useState('created_at:desc')
  const [statusFilter, setStatusFilter] = useState('')
  // 種別（単語・概念など）。タグと同じく複数選べる
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [activeTypes, setActiveTypes] = useState<string[]>([])
  // 種別の一覧。数は多くないので一度に引く
  useEffect(() => {
    getItemTypes()
      .then(setItemTypes)
      .catch(() => {})
  }, [])
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
  // その取り直しが「裏で追いかけているだけ」か。骨組みを出すかどうかの判断に使う
  const backgroundRefreshRef = useRef(false)
  // 一覧の並べ方（サーバーの設定から来る）。既定は「絵だけ」
  const [listBlocks, setListBlocks] = useState<string[]>(['image'])
  // 種別の印を出すか。**設定に行が無い人には出す**（サーバーが決める）
  const [showTypeMark, setShowTypeMark] = useState(true)
  // 一括AI操作（タグ再設定・付与・ファクトチェック・説明付与）の進捗とサマリ
  const [bulkAction, setBulkAction] = useState<{ label: string; kind: BulkKind; done: number; total: number } | null>(null)
  // いま処理しているカード。上の進捗だけだと「どれが対象か」が分からず、
  // 並んでいるカードのどこかが変わるのを待つことになる
  const [bulkCurrentId, setBulkCurrentId] = useState<string | null>(null)
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

  /**
   * 選んだカードの実体を覚えておく。
   *
   * **選択はページを移っても残る。** 1ページ目で20枚、2ページ目で5枚選べば
   * 操作は25枚に効く。だが `items` は**いま見えているページの分しか無い**ので、
   * id だけ持っていると「選んだ25枚」を画面に出せない。
   *
   * 溜めておけば、パネルの帯にも全部出せるし、
   * 「他のページのぶんも選んでいる」と伝えられる。
   */
  const [selectedCache, setSelectedCache] = useState<Map<string, Item>>(new Map())
  /** 「活用」で選んだ行き先の系統。パネルを開く前に決まる */
  const [useFamily, setUseFamily] = useState<BulkUseFamily>('canvas')

  const toggleSelect = (id: string) => {
    const item = items.find((row) => row.id === id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectedCache((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else if (item) next.set(id, item)
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setSelectedCache(new Map())
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
    include?: (id: string) => boolean,
    // 1枚ごとの結果に添える一言（「何を書いたか」は fn 側しか知らない）
    describe?: (id: string) => string | undefined
  ) => {
    const ids = [...selectedIds].filter((id) => !include || include(id))
    if (ids.length === 0) return
    cancelBulkRef.current = false
    setActionError(null)
    setBulkSummary(null)
    setBulkResults(null)
    setResultsOpen(false)
    setBulkAction({ label, kind, done: 0, total: ids.length })

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const titleOf = (id: string) => items.find((it) => it.id === id)?.title ?? id
    const entries: BulkResultEntry[] = []
    let processed = 0
    let skipped = 0
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      if (cancelBulkRef.current) break
      setBulkCurrentId(ids[i])
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
            entries.push({
              id: ids[i],
              title: result.title,
              outcome: 'processed',
              item: result,
              note: describe?.(ids[i]),
            })
          }
          break
        } catch (err) {
          const res = (err as { response?: { status?: number; headers?: Record<string, string> } }).response
          if (res?.status === 429 && attempt < 30 && !cancelBulkRef.current) {
            attempt += 1
            const retryAfter = Number(res.headers?.['retry-after']) || 5
            setBulkAction({ label: `${label}（混雑のため待機中）`, kind, done: i, total: ids.length })
            await sleep(Math.min(retryAfter, 60) * 1000)
            if (cancelBulkRef.current) break
            continue
          }
          failed += 1
          entries.push({ id: ids[i], title: titleOf(ids[i]), outcome: 'failed' })
          break
        }
      }
      setBulkAction({ label, kind, done: i + 1, total: ids.length })
    }

    setBulkCurrentId(null)
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
  const handleFactCheck = () => runBulkAi('説明のAIチェック', 'factcheck', (id) => factCheckItem(id))

  /**
   * 説明だけを見ると、項目に書いた誤りが素通りする。
   * **書いてあるもの全部**を見る道を別に置く（そのぶん時間と利用量は増える）。
   *
   * 結果には**何項目を見たか**を添える。判定だけでは
   * 「項目まで見たうえでの correct」なのかが分からない。
   */
  const handleFactCheckAll = () => {
    const scope = new Map<string, string>()
    return runBulkAi(
      'カード全体のAIチェック',
      'factcheck',
      async (id) => {
        const result = await factCheckItem(id, 'all')
        if (!isItemSkip(result)) {
          const count = (result.fact_check_fields ?? []).filter((name) => name !== '説明').length
          scope.set(id, count === 0 ? '説明のみを確認' : `説明と ${count} 項目を確認`)
        }
        return result
      },
      undefined,
      (id) => scope.get(id)
    )
  }

  // タグと説明だけを取り出した入口は無くした。**どちらも項目の一種**で、
  // そこだけ別の口を持つ理由が無い（`fill_properties` が全部まとめて見る）。
  // 1つだけ埋めたいときは「項目を選んで埋める」から選ぶ

  /**
   * 項目をまとめて埋める。
   *
   * **タグ・説明だけを取り出さない。** そこだけ入口を持っていたのは、
   * その3つを先に作ったからで、設計上の理由は無かった。
   * 項目は分野ごとに増えるので、**操作を軸に**しないと入口が増え続ける。
   *
   * サーバーは1回の呼び出しで全部の項目を見るので、
   * 項目が増えても費用と待ち時間は比例しない。
   *
   * @param keys 特定の項目だけに絞るとき。省略すればその種別の全部が対象
   */
  const runPropertyFill = (label: string, overwrite: boolean, keys?: string[]) => {
    /**
     * **どの項目が埋まったかを覚えておく。**
     *
     * 「12枚を処理しました」だけでは、AI が何を書いたのか分からない。
     * 項目は分野ごとに増えるので、カードによって埋まる数も中身も違う。
     * 結果の一覧で1枚ずつ開き直さずに済むように、名前を並べて返す。
     */
    const filled = new Map<string, string>()

    return runBulkAi(
      label,
      'property',
      async (id) => {
        const result = await fillItemProperties(id, { overwrite, ...(keys?.length ? { keys } : {}) })
        // 埋めた結果を画面へ返す。fill は結果の要約を返すので、カードは取り直す
        const item = await getItem(id)
        // key のままでは読めない。取り直したカードから見出しを引く
        const labelOf = new Map((item.properties ?? []).map((p) => [ p.key, p.label ]))
        const names = result.filled_keys.map((key) => labelOf.get(key) ?? key)
        filled.set(
          id,
          names.length ? `${names.length}項目を書きました: ${names.join(' / ')}` : '書ける項目がありませんでした'
        )
        return item
      },
      undefined,
      (id) => filled.get(id)
    )
  }

  const handlePropertyFill = () => runPropertyFill('項目を埋める', false)

  /**
   * 絵が語と噛み合っているかを見る。
   *
   * **運営が段階を開けるまで出さない。** 絵をそのまま送るので1回が高く、
   * 出来と費用を手元で見てから開けたい（栓は /admin にある）。
   */
  const imageCheckStage = useFeatureStage('image_fit_check')
  const imageCheckOpen = imageCheckStage === 'released' || imageCheckStage === 'prototype'
  const handleImageCheck = () => runBulkAi('イメージの点検', 'imagecheck', (id) => imageCheckItem(id))

  // 設定が要るものはパネルで開く。**対象のカードを見たまま決められるように**
  const openSection = useRightPanelStore((s) => s.openSection)
  const closePanel = useRightPanelStore((s) => s.close)
  const openPropertyPicker = () =>
    openSection({ key: BULK_PROPERTY_PANEL_KEY, title: '項目を選んで埋める' })
  // どの系統へ渡すかは、開く前に決まっている（ドロップダウンで選ばせる）。
  // パネルに両方を並べると、選ぶ手が一段増えるだけになる
  const openUsePanel = (family: BulkUseFamily) => {
    setUseFamily(family)
    openSection({
      key: BULK_USE_PANEL_KEY,
      title: family === 'box' ? 'ボックスへ渡す' : 'キャンバスへ渡す',
    })
  }

  // 選択中のカードの実体。**いま見えていないページのぶんも含む**
  const selectedItems = [...selectedIds].map((id) => selectedCache.get(id)).filter((i): i is Item => i != null)
  // いま見えているページの外にも選択があるか。あるなら、そう伝える
  const selectedOffPage = selectedItems.filter((item) => !items.some((row) => row.id === item.id)).length

  const handlePropertyReplace = () =>
    askBulk('項目をすべて作り直す', `選択 ${selectedIds.size} 件の項目を、AIの結果で置き換えます`, () =>
      runPropertyFill('項目を作り直す', true)
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
    setSelectedCache(allSelected ? new Map() : new Map(items.map((i) => [ i.id, i ])))
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
      .finally(() => {
        if (!cancelled) setTagsLoaded(true)
      })
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
        tagIds: activeTags,
        query: appliedQuery || undefined,
        sort,
        direction,
        status: statusFilter || undefined,
        itemTypeIds: activeTypes.length > 0 ? activeTypes : undefined,
      })
      setItems(fetched)
      if (meta.card_list) {
        setListBlocks(meta.card_list.blocks)
        setShowTypeMark(meta.card_list.type_mark)
      }
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

  // 留めたものを上に。タグ一覧で留めた並びを、絞り込みでも同じ扱いにする
  // （片方だけ並びが違うと、留めた意味が半分になる）
  const tagGroups = (() => {
    const keyword = tagQuery.trim().toLowerCase()
    const matched = keyword ? tags.filter((t) => t.name.toLowerCase().includes(keyword)) : tags
    const pinned = matched.filter((t) => t.pinned)
    const rest = matched.filter((t) => !t.pinned)

    return [
      { key: 'pinned', label: '留めたタグ', rows: pinned },
      // 留めたものが無ければ見出しも出さない（1つしか無い群に見出しは要らない）
      { key: 'rest', label: pinned.length > 0 ? 'そのほか' : null, rows: rest },
    ].filter((group) => group.rows.length > 0)
  })()

  const toggleTag = (tagId: string) => {
    setLoading(true)
    setActiveTags((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [ ...current, tagId ]
    )
    setPage(1)
  }

  const clearTags = () => {
    if (activeTags.length === 0) return
    setLoading(true)
    setActiveTags([])
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

    // **裏での取り直しでは、並んでいるものを消さない。**
    // 生成中を追いかける取り直し（usePendingRefresh）でも骨組みに戻していたため、
    // 1枚作っただけで一覧ぜんぶが骨組みになり、出来ているカードまで消えていた。
    // 骨組みを出すのは、並ぶ中身そのものが入れ替わるとき（頁・絞り込み・並び順）だけ。
    const background = backgroundRefreshRef.current
    backgroundRefreshRef.current = false
    if (shouldShowSkeleton({ background, hasItems: items.length > 0 })) setLoading(true)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 取得の引き金だけを並べる
  }, [page, activeTags.join(','), activeTypes.join(','), appliedQuery, sortKey, statusFilter, refreshToken, display.columns, display.rows])

  /*
    生成中のカードがある間だけ取り直す。
    パネルで作られたカードもストアへ入るので、ここが拾って完成を反映する。
  */
  // 取得そのものは効果の中で行う決まりなので、印を進めて効果を動かす。
  // **裏での取り直しである**ことを添えて、骨組みに戻さないようにする
  const refreshCurrentPage = useCallback(() => {
    backgroundRefreshRef.current = true
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

  // タグの絞り込みは、検索や種別と同じ「絞り込み操作群」として1行に収める。
  // タグだけ大きな帯にすると、並んでいるカードを見る面積が毎回削られる。
  // 中身は右パネルで開き、選んでいるものだけを一覧の上に札で残す。
  // 引き終える前から場所を取っておく。
  //
  // 「タグがあれば出す」だけにすると、タグを引き終えた瞬間にボタンが現れ、
  // 隣の検索欄（flex-1）が縮んで行が組み替わる。読み込みの間だけ画面が動くのは、
  // 押そうとしたものが動くということなので、押し間違いのもとになる。
  //
  // 引き終えて1件も無ければ、そこで初めて畳む（それ以上は動かない）。
  const tagFilterButton =
    !tagsLoaded || tags.length > 0 ? (
      <Button
        variant="outline"
        onClick={() => tagPanel.open()}
        aria-expanded={tagPanel.isOpen}
        disabled={!tagsLoaded}
        // 検索欄・プルダウンと同じ高さ（h-9）に揃える。
        // 1つだけ背が違うと、同じ絞り込みの操作なのに別のものに見える
        className="h-9 shrink-0 px-3 text-sm"
      >
        <TagIcon size={14} className="mr-1" />
        絞り込む{activeTags.length + activeTypes.length > 0 && `（${activeTags.length + activeTypes.length}）`}
      </Button>
    ) : null

  const tagPanelContent = (
    <PanelSlotContent sectionKey={FILTER_PANEL_KEY}>
      <div className="space-y-5">
        {/* 種別をタグより上に置く。**種別は数が少なく、粒も大きい**ので、
            先に絞ってからタグへ降りるほうが少ない手数で目的に着く。
            出しっぱなしにするのは、選べる種別が数個しかないため（畳む価値がない） */}
        {itemTypes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">種別で絞り込む</p>
              {activeTypes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTypes([])}
                  className="shrink-0 text-xs text-muted-foreground hover:underline"
                >
                  種別の選択を外す
                </button>
              )}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {itemTypes.map((type) => {
                const on = activeTypes.includes(type.id)
                return (
                  <li key={type.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setActiveTypes((prev) =>
                          prev.includes(type.id) ? prev.filter((id) => id !== type.id) : [ ...prev, type.id ]
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-[var(--palace)] bg-[rgba(198,167,94,0.12)] text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {type.label || type.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="space-y-3">
        {/* 探す窓を一番上に置く。タグが増えると、目で追うより打ったほうが早い */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="タグを探す"
            aria-label="タグを探す"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            選ぶほど狭くなります。選んだタグをすべて持つカードだけが残ります。
          </p>
          {activeTags.length > 0 && (
            <button type="button" onClick={clearTags} className="shrink-0 text-xs text-muted-foreground hover:underline">
              すべて解除
            </button>
          )}
        </div>

        {/* 札を流し込むのではなく、1行1件で並べる。
            札だと名前の長さで行がばらけ、数も右端に揃わないので、
            「どれが多いか」を目で比べられない。
            留めたものは上にまとめる（タグ一覧で留めた並びと同じ扱いにする） */}
        {tagGroups.map((group) => (
          <div key={group.key} className="space-y-1">
            {group.label && (
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                {group.key === 'pinned' && <Pin size={11} style={{ color: 'var(--palace)' }} />}
                {group.label}
              </p>
            )}
            <ul className="divide-y divide-border border-y border-border">
              {group.rows.map((tag) => {
                const active = activeTags.includes(tag.id)
                return (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      aria-pressed={active}
                      className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          active ? 'border-transparent' : 'border-border'
                        }`}
                        style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                      >
                        {active && <Check size={11} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{tag.item_count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {tagGroups.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            {tagQuery ? '見つかりませんでした。' : 'まだタグがありません。'}
          </p>
        )}
        </div>
      </div>
    </PanelSlotContent>
  )

  // 選んでいるタグは一覧の上に残す。パネルを閉じたあと、
  // 何で絞っているのか分からないまま「カードが少ない」と見えるのを防ぐ
  const activeTagChips =
    activeTags.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {activeTags.map((id) => {
          const tag = tags.find((t) => t.id === id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleTag(id)}
              className="flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs text-white"
              style={{ backgroundColor: 'var(--palace)' }}
              aria-label={`${tag?.name ?? 'タグ'} の絞り込みを外す`}
            >
              {tag?.name ?? 'タグ'}
              <X size={12} />
            </button>
          )
        })}
        <button type="button" onClick={clearTags} className="text-xs text-muted-foreground hover:underline">
          すべて解除
        </button>
      </div>
    ) : null

  const searchBox = (
    <div className="relative min-w-[200px] flex-1 basis-64">
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
      {/* 検索・種別・タグは同じ「絞り込み操作群」。1行に収める。
          タグを別行の帯にすると、絞り込みの一部なのに独立した機能に見えるうえ、
          カードを見る面積が毎回削られる。狭い画面でだけ折り返す */}
      <div className="flex flex-wrap items-center gap-2">
        {searchBox}
        {sortFilterControls}
        {tagFilterButton}
      </div>
      {activeTagChips}
      {tagPanelContent}
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
      <CardDisplayPanel
        display={display}
        onChange={changeDisplay}
        onLayoutSaved={() => setRefreshToken((token) => token + 1)}
      />
      <CardCreateButton />
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {filterBar}
        {/* 読み込み中の格子を本番と揃える。既定の5列8枚で描くと、
            10列25枚にしている人は一度組み替わる画面を見ることになる。
            形も揃える。「そろえる」なら正方形、「実寸」は枚ごとに違うので
            既定の比で置く（全部の比を先に知る術は無い） */}
        <CardGridSkeleton
          withTitle
          columns={display.columns}
          count={cardsPerPage(display)}
          aspectRatio={display.fit === 'uniform' ? '1 / 1' : aspectRatioCss(undefined)}
        />
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (items.length === 0) {
    if (activeTags.length > 0 || activeTypes.length > 0 || appliedQuery || statusFilter) {
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
      // 何も無い画面は、**説明できる唯一の場所**。ここを逃すと
      // 「何に使うのか」「1枚いくらか」を知らないまま作り始めることになる
      <div className="py-16 space-y-5 text-center">
        <p className="text-muted-foreground">まだカードがありません。言葉を入れて、最初のカードを作りましょう。</p>

        <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border/70 bg-muted/40 px-4 py-4 text-left">
          <div>
            <p className="text-sm font-medium">最初に試しやすい例</p>
            <p className="mt-2 text-sm text-muted-foreground">富士山、光合成、API、細胞分裂</p>
            <p className="mt-1 text-xs text-muted-foreground">具体的な言葉から始めると、絵が安定しやすいです。</p>
          </div>

          <div className="border-t border-border/60 pt-3">
            <p className="text-sm font-medium">こんな使い方ができます</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>単語帳として — 覚えたい語を絵で結びつける</li>
              <li>学習図鑑・用語集として — 分野の言葉をまとめて並べる</li>
              <li>ビジョンボード・絵日記として — 見たい景色を集める</li>
            </ul>
          </div>

          <div className="border-t border-border/60 pt-3">
            <p className="text-sm font-medium">クレジットについて</p>
            <p className="mt-2 text-sm text-muted-foreground">
              絵を1枚つくるたびに 1{CREDIT_UNIT_SHORT} 使います。受け取ってから{CREDIT_VALIDITY_LABEL}有効です。
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              同じ言葉を誰かが作っていれば、その絵をそのまま使います（待ち時間もかかりません）。
            </p>
            {/* 残りがどこに出るかまで言う。数だけ説明されても、
                次に「いま何枚ぶんあるのか」を画面のどこで見るのか分からない */}
            <p className="mt-1 text-xs text-muted-foreground">
              残りはいつでも画面上のヘッダーで確認できます。
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Link href="/items/new">
            <Button>カードを作成する</Button>
          </Link>
          {/* 説明を読み切りたい人の行き先。**釦の下に小さく**置く。
              ここを目立たせると、最初の1枚より先に読み物へ流れてしまう */}
          <p className="text-xs text-muted-foreground">
            <Link href="/guide" className="underline underline-offset-2 hover:text-foreground">
              使い方を見る
            </Link>
          </p>
        </div>
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
            <span className="hidden sm:inline">{allSelected ? 'すべて解除' : 'すべて選択'}</span>
          </button>
          {/*
            **狭い画面では、字を削って釦を残す。**
            「◯件を選択中」を書くと、横に並ぶ操作が画面の外へ押し出されて
            スクロールしないと見えなくなっていた。数だけなら幅を取らない。

            他のページで選んだぶんも操作の対象になる。見えていないものに効くので、
            黙っておかずに数を添える。
          */}
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {selectedIds.size}
            <span className="hidden sm:inline">件を選択中</span>
            <span className="sm:hidden">件</span>
            {selectedOffPage > 0 && (
              <span className="ml-1 text-2xs" title={`このページ以外で選んだ ${selectedOffPage} 件も対象になります`}>
                (他{selectedOffPage})
              </span>
            )}
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-1.5 overflow-x-auto sm:gap-2">
            {/*
              **操作を軸に、3つへ畳む。**

              以前はタグ・説明・画像が横に並んでいた。だがその3つを取り出していたのは
              先に作ったからで、設計上の理由は無い。**項目は分野ごとに増える**ので、
              対象ごとに入口を持つと増え続ける。

              イメージも、カードを成す要素のひとつ。別の入口にすると
              「絵は項目ではない」という誤った線を引くことになるので、編集の中へ入れる。
              ただし**クレジットを使う**ので、中では段を分けて費用を書く。

              「未設定だけ埋める」と「すべて作り直す」は結果が全く違うので、
              同じ札には載せない。上書きは取り消せないため、赤くして下へ置く。
            */}
            <BulkMenu label="編集" icon={<FileText size={14} />} disabled={bulkBusy || selectedIds.size === 0}>
              <DropdownMenuLabel>選択 {selectedIds.size} 件の項目</DropdownMenuLabel>
              <DropdownMenuItem onClick={handlePropertyFill}>
                未設定だけ埋める
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openPropertyPicker}>
                項目を選んで埋める…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePropertyReplace} variant="destructive">
                すべて作り直す（上書き）
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              {/* イメージだけは費用がかかる。段を分けて、枚数ぶんの cr を先に見せる */}
              <DropdownMenuLabel>イメージ</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleRegenerate(true)}>
                失敗したものだけ作り直す
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRegenerate(false)} variant="destructive">
                すべて作り直す（{selectedIds.size} cr）
              </DropdownMenuItem>
            </BulkMenu>

            <BulkMenu label="チェック" icon={<ShieldCheck size={14} />} disabled={bulkBusy || selectedIds.size === 0}>
              <DropdownMenuLabel>選択 {selectedIds.size} 件をチェック</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleFactCheck}>
                意味・説明が正しいか
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFactCheckAll}>
                カード全体（項目もすべて）
              </DropdownMenuItem>
              {imageCheckOpen && (
                <DropdownMenuItem onClick={handleImageCheck}>
                  イメージが合っているか
                </DropdownMenuItem>
              )}
            </BulkMenu>

            {/* 選んだカードを使う。**設定が要るものはパネルで開く**
                （新しく作るか、いまあるものへ足すかを、そこで決める） */}
            <BulkMenu label="活用" icon={<Sparkles size={14} />} disabled={bulkBusy || selectedIds.size === 0}>
              <DropdownMenuLabel>選択 {selectedIds.size} 件を</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openUsePanel('canvas')}>
                キャンバスを作る・追加する…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openUsePanel('box')}>
                ボックスを作る・追加する…
              </DropdownMenuItem>
              {/* **消さずに灰色で置く。** 消すと「できない」ではなく「無い」と読まれる。
                  スペースは点を選ばないと置けないので、ここからは作れない */}
              <DropdownMenuItem disabled>
                スペースを作る・追加する（準備中）
              </DropdownMenuItem>
            </BulkMenu>
            <span className="mx-0.5 h-5 w-px shrink-0 bg-border sm:mx-1" aria-hidden />
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
            <Button variant="ghost" size="sm" className="shrink-0" onClick={exitSelection} disabled={bulkBusy} aria-label="選択をやめる">
              <span className="hidden sm:inline">キャンセル</span>
              <X size={15} className="sm:hidden" />
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CardDisplayPanel
            display={display}
            onChange={changeDisplay}
            onLayoutSaved={() => setRefreshToken((token) => token + 1)}
          />
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
            blocks={listBlocks}
            showTypeMark={showTypeMark}
            density={densityFor(display.columns)}
            sizes={cardImageSizes(display.columns)}
            working={bulkCurrentId === item.id}
            workingLabel={bulkAction ? (BULK_BUSY_LABEL[bulkAction.kind] ?? null) : null}
          />
        ))}
      </div>

      {/* 設定が要る一括操作は、ここでパネルへ差し込む。
          **対象のカードを見たまま決められる**（覆い被さるモーダルにしない） */}
      <BulkPropertyPicker
        selected={selectedItems}
        onClose={closePanel}
        onRun={(keys, overwrite) => {
          closePanel()
          if (overwrite) {
            askBulk('選んだ項目を作り直す', `選択 ${selectedIds.size} 件の ${keys.length} 項目を置き換えます`, () =>
              runPropertyFill('項目を作り直す', true, keys)
            )
            return
          }
          runPropertyFill('項目を埋める', false, keys)
        }}
      />
      <BulkUsePanel
        family={useFamily}
        selected={selectedItems}
        onClose={closePanel}
        onCreated={() => {
          closePanel()
          exitSelection()
        }}
      />

      <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
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
        {/* 見出し（DropdownMenuLabel）は群の中でしか使えない。
            包まずに置くと Base UI が MenuGroupContext を見つけられず落ちる。
            中身は必ずここに包む */}
        <DropdownMenuGroup>{children}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
