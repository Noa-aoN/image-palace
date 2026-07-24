'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, ChevronUp, ChevronDown, Loader2, Route, DoorOpen, Play, Search, Images } from 'lucide-react'
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
// キャンバスはクライアント専用（React Flow 等の重い依存）。サーバ Worker から外すため ssr:false で遅延読込。
const RoomCanvas = dynamic(
  () => import('@/components/features/views/RoomCanvas').then((m) => m.RoomCanvas),
  { ssr: false, loading: () => <div className="h-[60vh] animate-pulse rounded-xl bg-muted" /> }
)
import { EntityCover } from '@/components/features/shared/EntityCover'
import { SpaceWalkthrough } from '@/components/features/spaces/walkthrough/SpaceWalkthrough'
import { stopsFromSpacePoints } from '@/components/features/spaces/walkthrough/constants'
import { CoverSettings } from '@/components/features/shared/CoverSettings'
import type { SpaceDetail, SpacePoint } from '@/types/space'
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

// ポイントの画像（配置カードの画像を優先、無ければ名前から生成したロキ画像）。クリックで拡大。
function PointImageCell({ point, onZoom }: { point: SpacePoint; onZoom: (url: string, alt: string) => void }) {
  const media = point.item?.media ?? point.image
  const imageUrl = media?.thumb_url ?? media?.url ?? null
  const fullUrl = media?.url ?? media?.thumb_url ?? null
  // 有効画像が無く（生成前・カード未配置）、名前があり、生成中ステータスのときだけスピナー。
  const generating = !media && !!point.name && POLLING_STATUSES.has(point.generation_status)
  const alt = point.name ?? 'ポイント画像'

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {imageUrl ? (
        <button type="button" onClick={() => fullUrl && onZoom(fullUrl, alt)} aria-label="画像を拡大" className="h-full w-full">
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
  onZoom,
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
  onZoom: (url: string, alt: string) => void
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
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="上へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp size={16} /></button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label="下へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown size={16} /></button>
          <button onClick={() => onRemove(point.id)} aria-label="ポイントを削除" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-3 pl-10">
        <PointImageCell point={point} onZoom={onZoom} />
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
  const [imageZoom, setImageZoom] = useState<{ url: string; alt: string } | null>(null)
  const [pickerPointId, setPickerPointId] = useState<string | null>(null)
  const [busyPoint, setBusyPoint] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
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
  // room キャンバスでのドラッグ確定時に座標を state へ反映（保存は RoomCanvas が行う）
  const handleMovePointXY = useCallback((pointId: string, x: number, y: number) => {
    setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, x, y } : p)))
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
        {!isRoad && <RoomCanvas spaceId={id} points={points} onMoved={handleMovePointXY} />}
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
                onZoom={(url, alt) => setImageZoom({ url, alt })}
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
      {imageZoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setImageZoom(null)}
          role="dialog"
          aria-modal="true"
          aria-label="画像を拡大"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageZoom.url} alt={imageZoom.alt} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          <button
            type="button"
            onClick={() => setImageZoom(null)}
            aria-label="閉じる"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
