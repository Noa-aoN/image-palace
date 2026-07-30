'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2, Route, DoorOpen, Play, Search, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { CardImage } from '@/components/ui/card-image'
import {
  getSpace,
  updateSpace,
  deleteSpace,
  addSpacePoint,
  updateSpacePoint,
  removeSpacePoint,
  reorderSpacePoints,
  uploadSpaceCover,
  removeSpaceCover,
} from '@/lib/api/spaces'
import { getItemsPage } from '@/lib/api/items'
import type { Item } from '@/types/item'
import { spaceTypeLabel } from '@/lib/space-types'
// 面キャンバスはブラウザ API（pointer/getBoundingClientRect）を使うクライアント専用。ssr:false で遅延読込。
const RoomCanvas = dynamic(
  () => import('@/components/features/views/RoomCanvas').then((m) => m.RoomCanvas),
  { ssr: false, loading: () => <div className="mx-auto aspect-square w-full max-w-2xl animate-pulse rounded-xl bg-muted" /> }
)
// 3D 部屋ビュー（react-three-fiber）。重い依存なのでこのページでのみ ssr:false 遅延読込。
const Room3D = dynamic(
  () => import('@/components/features/views/Room3D').then((m) => m.Room3D),
  { ssr: false, loading: () => <div className="h-[60vh] w-full animate-pulse rounded-xl bg-muted" /> }
)
import { EntityCover } from '@/components/features/shared/EntityCover'
import { SpaceWalkthrough } from '@/components/features/spaces/walkthrough/SpaceWalkthrough'
import { stopsFromSpacePoints } from '@/components/features/spaces/walkthrough/constants'
import { PointDetailModal } from '@/components/features/spaces/walkthrough/PointDetailModal'
import { CoverSettings } from '@/components/features/shared/CoverSettings'
import type { SpaceDetail, SpacePoint, RoomSurface } from '@/types/space'
import { PLACEABLE_SURFACES, SURFACE_NAV, roomSurfaceShort } from '@/lib/room-surfaces'
import type { CoverType } from '@/types/cover'

// カバー画像が無いスペースのフォールバック（ルーム=部屋 / ロード=道）
function SpaceCoverFallback({ spaceType }: { spaceType: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      {spaceType === 'road' ? (
        <Route size={28} className="text-muted-foreground/50" />
      ) : (
        <DoorOpen size={28} className="text-muted-foreground/50" />
      )}
    </div>
  )
}

// 生成中とみなすステータス（ポーリング継続条件）
const POLLING_STATUSES = new Set(['pending', 'processing'])


// 既存カードを配置する検索ピッカー（モーダル）。カードの画像を点の背景画像に使う。
function CardPicker({ onSelect, onClose }: { onSelect: (item: Item) => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handle = setTimeout(() => setAppliedQuery(query.trim()), 300)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    let cancelled = false
    getItemsPage(1, 50, { query: appliedQuery || undefined })
      .then((res) => { if (!cancelled) setItems(res.items) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [appliedQuery])

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">既存カードを配置</span>
          <button type="button" onClick={onClose} aria-label="閉じる" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="カードを検索" autoFocus aria-label="カード検索" className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">読み込み中…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground">カードがありません。</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => (
                <button key={item.id} type="button" onClick={() => onSelect(item)} className="flex flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition-shadow hover:shadow-md">
                  <CardImage src={item.media?.thumb_url ?? item.media?.url ?? null} blur={item.media?.blur} alt={item.title} className="aspect-square w-full" fallback={<span className="px-1 text-center text-[10px] text-muted-foreground">{item.title}</span>} />
                  <span className="truncate px-1.5 py-1 text-[11px] font-medium">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ポイントの画像（配置カードの画像を優先、無ければ名前から生成したロキ画像）。クリックで詳細モーダル。
function PointImageCell({ point, onOpen }: { point: SpacePoint; onOpen: () => void }) {
  const media = point.item?.media ?? point.image
  const imageUrl = media?.thumb_url ?? media?.url ?? null
  // 有効画像が無く（生成前・カード未配置）、名前があり、生成中ステータスのときだけスピナー。
  const generating = !media && !!point.name && POLLING_STATUSES.has(point.generation_status)
  const alt = point.name ?? 'ポイント画像'

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {imageUrl ? (
        <button type="button" onClick={onOpen} aria-label="詳細を見る" className="h-full w-full">
          <CardImage src={imageUrl} blur={(media as { blur?: string } | null)?.blur} alt={alt} className="h-full w-full" />
        </button>
      ) : generating ? (
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      ) : (
        <span className="px-1 text-center text-[9px] text-muted-foreground">画像なし</span>
      )}
    </div>
  )
}

// 部屋の寸法（グリッド単位＝整数。1マス=1m の床グリッドと一致）
const ROOM_DIMS: { key: 'width' | 'depth' | 'height'; label: string; min: number; max: number }[] = [
  { key: 'width', label: '幅', min: 2, max: 10 },
  { key: 'depth', label: '奥行き', min: 2, max: 10 },
  { key: 'height', label: '高さ', min: 2, max: 5 },
]

// タブ用の面ピクトグラム（俯瞰＝箱を上から / 各壁＝該当辺を強調）
function FaceGlyph({ surface }: { surface: RoomSurface }) {
  const edge =
    surface === 'wall_north'
      ? 'top'
      : surface === 'wall_south'
        ? 'bottom'
        : surface === 'wall_east'
          ? 'right'
          : surface === 'wall_west'
            ? 'left'
            : null
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" className="shrink-0" aria-hidden>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      {surface === 'floor' && <rect x="4.5" y="4.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />}
      {edge === 'top' && <line x1="1.5" y1="1.7" x2="12.5" y2="1.7" stroke="currentColor" strokeWidth="2.4" />}
      {edge === 'bottom' && <line x1="1.5" y1="12.3" x2="12.5" y2="12.3" stroke="currentColor" strokeWidth="2.4" />}
      {edge === 'left' && <line x1="1.7" y1="1.5" x2="1.7" y2="12.5" stroke="currentColor" strokeWidth="2.4" />}
      {edge === 'right' && <line x1="12.3" y1="1.5" x2="12.3" y2="12.5" stroke="currentColor" strokeWidth="2.4" />}
    </svg>
  )
}

// 2D の上下左右インジケータ（隣の面へ視点移動）
function FaceNavArrow({
  dir,
  label,
  onClick,
}: {
  dir: 'up' | 'down' | 'left' | 'right'
  label: string
  onClick: () => void
}) {
  const posClass = {
    up: 'left-1/2 top-1.5 -translate-x-1/2 flex-col',
    down: 'bottom-1.5 left-1/2 -translate-x-1/2 flex-col-reverse',
    left: 'left-1.5 top-1/2 -translate-y-1/2 flex-row',
    right: 'right-1.5 top-1/2 -translate-y-1/2 flex-row-reverse',
  }[dir]
  const Icon = { up: ChevronUp, down: ChevronDown, left: ChevronLeft, right: ChevronRight }[dir]
  return (
    <button
      onClick={onClick}
      className={`absolute z-20 flex items-center gap-0.5 rounded-full border border-border bg-background/85 px-1.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground ${posClass}`}
      aria-label={`${label}へ移動`}
      title={`${label}へ`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  )
}

function PointRow({
  point,
  index,
  total,
  onGenerate,
  onMove,
  onRemove,
  onPlaceCardClick,
  onClearCard,
  onSaveName,
  onOpenDetail,
  showSurface = false,
  onSetSurface,
}: {
  point: SpacePoint
  index: number
  total: number
  onGenerate: (pointId: string, name: string) => void
  onMove: (index: number, dir: -1 | 1) => void
  onRemove: (pointId: string) => void
  onPlaceCardClick: (pointId: string) => void
  onClearCard: (pointId: string) => void
  onSaveName: (pointId: string, name: string) => void
  onOpenDetail: (index: number) => void
  showSurface?: boolean
  onSetSurface?: (pointId: string, surface: RoomSurface) => void
}) {
  // ドラフトは名前で初期化。key に point.name を含めるので、配置/生成で名前が変わると再初期化される。
  const [draft, setDraft] = useState(point.name ?? '')
  const trimmed = draft.trim()
  const hasImage = !!point.image || !!point.item
  const generating = !point.image && !point.item && !!point.name && POLLING_STATUSES.has(point.generation_status)
  const failed = !point.item && !!point.name && point.generation_status === 'failed'
  // 生成可能: 名前があり、生成中でなく、「カード無しで同じ名前が生成済み」でないとき。
  const canGenerate =
    trimmed.length > 0 &&
    !generating &&
    !(trimmed === (point.name ?? '') && point.generation_status === 'completed' && !point.item)

  // 名前だけ保存（生成しない）。既に画像/カードがある点でのみ実行（未生成点の“生成中”誤表示を避ける）。
  const handleNameBlur = () => {
    if (trimmed && trimmed !== (point.name ?? '') && hasImage) onSaveName(point.id, trimmed)
  }

  return (
    <li className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--palace)' }}
        >
          {index + 1}
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="ポイント名（例: 玄関）"
          aria-label={`ポイント${index + 1}の名前`}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {showSurface && onSetSurface && (
          <select
            value={point.surface ?? 'floor'}
            onChange={(e) => onSetSurface(point.id, e.target.value as RoomSurface)}
            aria-label={`ポイント${index + 1}の面`}
            title="この点を置く面"
            className="shrink-0 rounded-lg border border-input bg-background px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {PLACEABLE_SURFACES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.short}
              </option>
            ))}
          </select>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="上へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp size={16} /></button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label="下へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown size={16} /></button>
          <button onClick={() => onRemove(point.id)} aria-label="ポイントを削除" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-3 pl-10">
        <PointImageCell point={point} onOpen={() => onOpenDetail(index)} />
        <div className="min-w-0 flex-1 space-y-2">
          {failed && (
            <p className="text-xs text-destructive">{point.generation_error ?? '生成に失敗しました。もう一度「生成」を押してください。'}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => onGenerate(point.id, trimmed)} disabled={!canGenerate}>
              {generating ? '生成中…' : point.image && !point.item ? '再生成' : '生成'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPlaceCardClick(point.id)} className="flex items-center gap-1">
              <Images size={13} />
              {point.item ? 'カードを変更' : '既存カードを配置'}
            </Button>
            {point.item && (
              <Button variant="ghost" size="sm" onClick={() => onClearCard(point.id)}>カードを外す</Button>
            )}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {point.item
              ? `カードの画像を使用中：${point.item.title}`
              : '「生成」は名前から画像を作成し、1クレジット消費します。「既存カードを配置」はカードの画像を使い、消費しません。'}
          </p>
        </div>
      </div>
    </li>
  )
}

export default function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [space, setSpace] = useState<SpaceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ポイント
  const [playerOpen, setPlayerOpen] = useState(false)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [pickerPointId, setPickerPointId] = useState<string | null>(null)
  const [busyPoint, setBusyPoint] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [activeSurface, setActiveSurface] = useState<RoomSurface>('floor')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d')
  // 部屋サイズ変更にポイントサイズを追従させるか（localStorage 永続・スペース単位）
  const [autoScale, setAutoScale] = useState(false)
  const autoScaleRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    getSpace(id)
      .then((data) => {
        if (!cancelled) setSpace(data)
      })
      .catch(() => {
        if (!cancelled) setError('スペースの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const setPoints = useCallback((updater: (ps: SpacePoint[]) => SpacePoint[]) => {
    setSpace((prev) => (prev ? { ...prev, points: updater(prev.points ?? []) } : prev))
  }, [])

  // 自動追従フラグの読み書き（localStorage・スペース単位）
  useEffect(() => {
    autoScaleRef.current = autoScale
  }, [autoScale])
  useEffect(() => {
    const stored = window.localStorage.getItem(`room-auto-scale-${id}`)
    if (stored !== null) setAutoScale(stored === '1')
  }, [id])
  useEffect(() => {
    window.localStorage.setItem(`room-auto-scale-${id}`, autoScale ? '1' : '0')
  }, [autoScale, id])

  // ポイント画像生成のポーリング: 生成中のポイントがある間、3秒ごとにスペースを再取得する
  useEffect(() => {
    const points = space?.points ?? []
    const hasPending = points.some((p) => p.name && POLLING_STATUSES.has(p.generation_status))
    if (!hasPending) return

    pollRef.current = setTimeout(async () => {
      try {
        const fresh = await getSpace(id)
        setSpace(fresh)
      } catch {
        // 一時的な失敗は次のポーリングで回復を試みる
      }
    }, 3000)

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [space?.points, id])

  const startEdit = () => {
    if (!space) return
    setNameDraft(space.name)
    setDescDraft(space.description ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !space) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateSpace(id, { name: trimmed, description: descDraft.trim() })
      setSpace((prev) => (prev ? { ...prev, name: updated.name, description: updated.description } : prev))
      setEditing(false)
    } catch {
      setError('スペースの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteSpace(id)
      router.push('/spaces')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // --- ポイント操作 ---
  // カバー設定（デッキ踏襲。候補はポイントの生成画像）
  const handleSetCoverType = async (coverType: CoverType) => {
    if (!space || space.cover_type === coverType) return
    setCoverBusy(true)
    try {
      const updated = await updateSpace(id, { cover_type: coverType })
      setSpace((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setError('カバー表示の変更に失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }
  const handleUploadCover = async (file: File) => {
    if (!space) return
    setCoverBusy(true)
    try {
      const updated = await uploadSpaceCover(id, file)
      setSpace((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setError('画像のアップロードに失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }
  const handleRemoveCover = async () => {
    if (!space) return
    setCoverBusy(true)
    try {
      const updated = await removeSpaceCover(id)
      setSpace((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setError('画像の削除に失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }

  const handleAddPoint = async () => {
    setBusyPoint(true)
    try {
      const point = await addSpacePoint(id)
      setPoints((ps) => [...ps, point])
    } catch {
      setError('ポイントの追加に失敗しました')
    } finally {
      setBusyPoint(false)
    }
  }
  // 「生成」ボタン: カードを外して名前から画像を生成する（1クレジット消費）。
  const handleGeneratePoint = async (pointId: string, name: string) => {
    try {
      const updated = await updateSpacePoint(id, pointId, { name, item_id: null, generate: true })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('画像生成の開始に失敗しました')
    }
  }
  // 既存カードを配置: カードの画像を点の背景に使い、カード名を点名に入れる（生成しない・無料）。
  const handlePlaceCard = async (item: Item) => {
    const pointId = pickerPointId
    if (!pointId) return
    setPickerPointId(null)
    try {
      const updated = await updateSpacePoint(id, pointId, { item_id: item.id, name: item.title, generate: false })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードの配置に失敗しました')
    }
  }
  const handleClearCard = async (pointId: string) => {
    try {
      const updated = await updateSpacePoint(id, pointId, { item_id: null })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードの解除に失敗しました')
    }
  }
  // 名前だけ保存（生成しない）。カード配置済み/生成済みの点のフォーカスアウト時に呼ぶ。
  const handleSaveName = async (pointId: string, name: string) => {
    try {
      const updated = await updateSpacePoint(id, pointId, { name, generate: false })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('ポイント名の保存に失敗しました')
    }
  }
  // 点を別の面へ移す（面内中央にリセットして保存）。移した面へ表示も切り替えて着地を見せる。
  const handleSetSurface = useCallback((pointId: string, surface: RoomSurface) => {
    setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, surface, u: 0.5, v: 0.5 } : p)))
    setActiveSurface(surface)
    updateSpacePoint(id, pointId, { surface, u: 0.5, v: 0.5 }).catch(() => {})
  }, [id, setPoints])

  // 2D/3D いずれのドラッグでも、面と面内座標を state へ反映（保存はキャンバス側が行う）
  const handleMovePoint = useCallback((pointId: string, surface: RoomSurface, u: number, v: number) => {
    setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, surface, u, v } : p)))
  }, [setPoints])

  // 部屋の設定変更（寸法・共通ポイントサイズ）: 即ローカル反映＋デバウンス保存
  const dimSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSpaceSetting = useCallback(
    (patch: Partial<Pick<SpaceDetail, 'width' | 'depth' | 'height' | 'point_scale'>>) => {
      setSpace((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        // 自動追従 ON かつ寸法変更なら、ポイントサイズも控えめに追従させる
        const dimKeys = (['width', 'depth', 'height'] as const).filter((k) => k in patch)
        if (autoScaleRef.current && dimKeys.length > 0) {
          let ratio = 1
          for (const k of dimKeys) ratio *= next[k] / prev[k]
          ratio = Math.pow(ratio, 0.4 / dimKeys.length)
          next.point_scale = Math.min(2, Math.max(0.5, prev.point_scale * ratio))
        }
        if (dimSaveTimer.current) clearTimeout(dimSaveTimer.current)
        dimSaveTimer.current = setTimeout(() => {
          updateSpace(id, { width: next.width, depth: next.depth, height: next.height, point_scale: next.point_scale }).catch(() => {})
        }, 350)
        return next
      })
    },
    [id]
  )

  // 個別ポイントサイズ変更（2D のハンドルドラッグ）を state に反映（保存は RoomCanvas）
  const handleScalePoint = useCallback((pointId: string, scale: number) => {
    setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, scale } : p)))
  }, [setPoints])
  const handleRemovePoint = async (pointId: string) => {
    setPoints((ps) => ps.filter((p) => p.id !== pointId))
    try {
      await removeSpacePoint(id, pointId)
    } catch {
      setError('ポイントの削除に失敗しました')
    }
  }
  const movePoint = async (index: number, dir: -1 | 1) => {
    if (!space?.points) return
    const target = index + dir
    if (target < 0 || target >= space.points.length) return
    const next = [...space.points]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPoints(() => next)
    try {
      await reorderSpacePoints(id, next.map((p) => p.id))
    } catch {
      setError('並び替えに失敗しました')
    }
  }

  if (error && !space) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/spaces"><Button variant="outline">← スペース一覧へ</Button></Link>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-20 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  const points = space.points ?? []
  const isRoad = space.space_type === 'road'
  const intro = isRoad
    ? '序数のあるポイントを並べ、各点に画像を1つ設定します。名前から「生成」（1クレジット）するか、「既存カードを配置」（無料・カード画像を使用）できます。連結法/ジャーニー法の道になります。'
    : '部屋のポイントをドラッグで間取りに配置できます。各点の画像は「生成」または「既存カードを配置」で1つ設定します。'

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Breadcrumb items={[{ href: '/spaces', label: 'スペース' }, { label: space.name }]} />

      {editing ? (
        <div className="space-y-3 mb-8">
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} disabled={saving} autoFocus aria-label="スペース名" className="text-lg" />
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            disabled={saving}
            rows={3}
            placeholder="説明（任意）"
            aria-label="スペースの説明"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5"><Check size={14} />保存</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1.5"><X size={14} />キャンセル</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold truncate">{space.name}</h1>
              <span className="text-sm text-muted-foreground shrink-0">{spaceTypeLabel(space.space_type)}</span>
              <button onClick={startEdit} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-label="スペースを編集">
                <Pencil size={16} />
              </button>
            </div>
            {space.description && (
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{space.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlayerOpen(true)}
              disabled={points.length === 0}
              className="flex items-center gap-1.5"
              aria-label="ウォークスルーを再生"
            >
              <Play size={14} />
              ウォークスルー
            </Button>
            <Button
              variant={confirmDelete ? 'destructive' : 'ghost'}
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              onBlur={() => setConfirmDelete(false)}
              className="flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              {deleting ? '削除中...' : confirmDelete ? '本当に削除' : '削除'}
            </Button>
          </div>
        </div>
      )}

      {/* カバー（ヘッダー）設定 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <EntityCover cover={space} fallback={<SpaceCoverFallback spaceType={space.space_type} />} />
        </div>
        <div className="flex-1">
          <CoverSettings
            coverType={space.cover_type}
            busy={coverBusy}
            hasCustom={!!space.cover_image}
            helpText="先頭/コラージュ: ポイントの生成画像を使用 / カスタム: アップロード画像"
            onSelectType={handleSetCoverType}
            onUpload={handleUploadCover}
            onRemove={handleRemoveCover}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">{intro}</p>
        {!isRoad && (
          <div className="space-y-2">
            {/* 部屋の設定（サイズ）。3D/2D の表示に即反映 */}
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer select-none text-sm font-medium">部屋の設定（サイズ）</summary>
              <div className="mt-2 space-y-2">
                {ROOM_DIMS.map((d) => {
                  const val = Math.round(space[d.key])
                  const setDim = (raw: number) => {
                    if (Number.isNaN(raw)) return
                    handleSpaceSetting({ [d.key]: Math.round(Math.min(d.max, Math.max(d.min, raw))) })
                  }
                  return (
                    <label key={d.key} className="flex items-center gap-3 text-xs">
                      <span className="w-12 shrink-0 text-muted-foreground">{d.label}</span>
                      <input
                        type="range"
                        min={d.min}
                        max={d.max}
                        step={1}
                        value={val}
                        onChange={(e) => setDim(Number(e.target.value))}
                        className="flex-1 accent-[var(--palace)]"
                        aria-label={`部屋の${d.label}（スライダー）`}
                      />
                      <input
                        type="number"
                        min={d.min}
                        max={d.max}
                        step={1}
                        value={val}
                        onChange={(e) => setDim(Number(e.target.value))}
                        className="w-14 shrink-0 rounded border border-input bg-background px-1.5 py-1 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`部屋の${d.label}（数値）`}
                      />
                      <span className="shrink-0 text-muted-foreground">マス</span>
                    </label>
                  )
                })}
              </div>
            </details>

            {/* ポイントの設定（部屋の設定のスタイルを踏襲） */}
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer select-none text-sm font-medium">ポイントの設定</summary>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 text-muted-foreground">ポイント表示サイズ</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={space.point_scale}
                    onChange={(e) => handleSpaceSetting({ point_scale: Number(e.target.value) })}
                    className="flex-1 accent-[var(--palace)]"
                    aria-label="ポイント表示サイズ"
                  />
                  <span className="w-16 shrink-0 text-right tabular-nums">×{space.point_scale.toFixed(1)}</span>
                </label>
                <label className="flex items-center justify-end gap-2 text-xs">
                  <span className="text-muted-foreground">部屋サイズ自動追従</span>
                  <input
                    type="checkbox"
                    checked={autoScale}
                    onChange={(e) => setAutoScale(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--palace)]"
                    aria-label="部屋サイズ自動追従"
                  />
                </label>
              </div>
            </details>

            {/* 2D/3D 切替（主体）。3D=部屋を回して床・壁へドラッグ配置 / 2D=面ごとの平面配置 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                {(['3d', '2d'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    className={`px-3 py-1 text-xs font-semibold transition-colors ${
                      viewMode === mode ? 'bg-[var(--palace)] text-white' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* 2D のときだけ面セレクタ（3D は回して全面を見る）。天井は除外 */}
              {viewMode === '2d' && (
                <div className="flex flex-wrap gap-1.5">
                  {PLACEABLE_SURFACES.map((s) => {
                    const count = points.filter((p) => (p.surface ?? 'floor') === s.key).length
                    const active = activeSurface === s.key
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActiveSurface(s.key)}
                        aria-pressed={active}
                        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-[var(--palace)] bg-[var(--palace)]/10 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <FaceGlyph surface={s.key} />
                        {s.key.startsWith('wall_') ? `${s.short}面` : s.short}
                        <span className="text-[10px] opacity-70">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {viewMode === '3d' ? (
              <Room3D spaceId={id} points={points} width={space.width} depth={space.depth} height={space.height} pointScale={space.point_scale} onMoved={handleMovePoint} />
            ) : (
              <div className="relative mx-auto w-full max-w-2xl">
                <RoomCanvas
                  spaceId={id}
                  points={points}
                  surface={activeSurface}
                  width={space.width}
                  depth={space.depth}
                  height={space.height}
                  pointScale={space.point_scale}
                  onMoved={handleMovePoint}
                  onScaled={handleScalePoint}
                />
                {/* 上下左右で隣の面へ（視点移動） */}
                {(['up', 'down', 'left', 'right'] as const).map((dir) => {
                  const target = SURFACE_NAV[activeSurface][dir]
                  return target ? (
                    <FaceNavArrow key={dir} dir={dir} label={roomSurfaceShort(target)} onClick={() => setActiveSurface(target)} />
                  ) : null
                })}
              </div>
            )}
          </div>
        )}
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">まだポイントがありません。「ポイントを追加」で点を作りましょう。</p>
        ) : (
          <ol className="space-y-2">
            {points.map((point, index) => (
              <PointRow
                key={`${point.id}:${point.name ?? ''}`}
                point={point}
                index={index}
                total={points.length}
                onGenerate={handleGeneratePoint}
                onMove={movePoint}
                onRemove={handleRemovePoint}
                onPlaceCardClick={setPickerPointId}
                onClearCard={handleClearCard}
                onSaveName={handleSaveName}
                onOpenDetail={setDetailIndex}
                showSurface={!isRoad}
                onSetSurface={handleSetSurface}
              />
            ))}
          </ol>
        )}
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={handleAddPoint} disabled={busyPoint} className="flex items-center gap-1.5">
            <Plus size={14} />ポイントを追加
          </Button>
        </div>
      </section>

      {pickerPointId && <CardPicker onSelect={handlePlaceCard} onClose={() => setPickerPointId(null)} />}
      {playerOpen && (
        <SpaceWalkthrough
          stops={stopsFromSpacePoints(space.points ?? [])}
          title={space.name}
          spaceType={space.space_type}
          onClose={() => setPlayerOpen(false)}
        />
      )}
      {detailIndex !== null && (
        <PointDetailModal
          stops={stopsFromSpacePoints(space.points ?? [])}
          index={detailIndex}
          onIndex={setDetailIndex}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </div>
  )
}
