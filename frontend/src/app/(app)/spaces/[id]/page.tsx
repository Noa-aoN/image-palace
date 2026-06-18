'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, ChevronUp, ChevronDown, Search, Loader2, Route, DoorOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { spaceTypeLabel } from '@/lib/space-types'
import { RoomCanvas } from '@/components/features/views/RoomCanvas'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { CoverSettings } from '@/components/features/shared/CoverSettings'
import type { SpaceDetail, SpacePoint } from '@/types/space'
import type { Item } from '@/types/item'
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

// road / room 種別: カード割当の検索ピッカー（モーダル）
function AssignCardModal({ onSelect, onClose }: { onSelect: (item: Item) => void; onClose: () => void }) {
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
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appliedQuery])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">カードを割り当て</span>
          <button type="button" onClick={onClose} aria-label="閉じる" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="カードを検索"
              autoFocus
              aria-label="カード検索"
              className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">読み込み中…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground">カードがありません。</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => {
                const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition-shadow hover:shadow-md"
                  >
                    <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="px-1 text-center text-[10px] text-muted-foreground">{item.title}</span>
                      )}
                    </div>
                    <span className="truncate px-1.5 py-1 text-[11px] font-medium">{item.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ポイント名から生成した画像（生成中はスピナー、失敗はメッセージ）
function PointImageCell({ point }: { point: SpacePoint }) {
  const generating = !!point.name && POLLING_STATUSES.has(point.generation_status)
  const imageUrl = point.image?.thumb_url ?? point.image?.url ?? null

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={point.name ?? 'ポイント画像'} className="h-full w-full object-cover" loading="lazy" />
      ) : generating ? (
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      ) : (
        <span className="px-1 text-center text-[9px] text-muted-foreground">
          {point.name ? '画像なし' : '名前で生成'}
        </span>
      )}
    </div>
  )
}

// 割り当てカードの表示
function AssignedCard({ item }: { item: SpacePoint['item'] }) {
  if (!item) return <span className="text-xs text-muted-foreground">カード未割当</span>
  const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="px-0.5 text-center text-[8px] text-muted-foreground">{item.title}</span>
        )}
      </div>
      <span className="truncate text-xs font-medium">{item.title}</span>
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
  onAssignClick,
  onClearCard,
}: {
  point: SpacePoint
  index: number
  total: number
  onGenerate: (pointId: string, name: string) => void
  onMove: (index: number, dir: -1 | 1) => void
  onRemove: (pointId: string) => void
  onAssignClick: (pointId: string) => void
  onClearCard: (pointId: string) => void
}) {
  // ドラフトは初期表示時の名前で初期化（key=point.id で安定）。
  // 生成は「生成」ボタンを押したときだけ実行する（入力やフォーカス外しでは走らせない）。
  const [draft, setDraft] = useState(point.name ?? '')

  const trimmed = draft.trim()
  const generating = !!point.name && POLLING_STATUSES.has(point.generation_status)
  const failed = !!point.name && point.generation_status === 'failed'
  // 名前があり、生成中でなく、「同じ名前で既に生成済み」でないときに生成可能
  // （＝新規・名前変更・失敗からの再試行）
  const canGenerate =
    trimmed.length > 0 &&
    !generating &&
    !(trimmed === (point.name ?? '') && point.generation_status === 'completed')

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
          placeholder="ポイント名（例: 玄関）"
          aria-label={`ポイント${index + 1}の名前`}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm" onClick={() => onGenerate(point.id, trimmed)} disabled={!canGenerate} className="shrink-0">
          {generating ? '生成中…' : '生成'}
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="上へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp size={16} /></button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label="下へ" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown size={16} /></button>
          <button onClick={() => onRemove(point.id)} aria-label="ポイントを削除" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3 pl-10">
        <PointImageCell point={point} />
        <div className="min-w-0 flex-1 space-y-1">
          {generating && <p className="text-xs text-muted-foreground">画像を生成中…</p>}
          {failed && (
            <p className="text-xs text-destructive">{point.generation_error ?? '生成に失敗しました。もう一度「生成」を押してください。'}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <AssignedCard item={point.item} />
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => onAssignClick(point.id)}>
                {point.item ? '変更' : 'カードを割当'}
              </Button>
              {point.item && <Button variant="ghost" size="sm" onClick={() => onClearCard(point.id)}>クリア</Button>}
            </div>
          </div>
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
  // 「生成」ボタン押下時のみ呼ばれる。名前を送ると同時に画像生成が始まる。
  const handleGeneratePoint = async (pointId: string, name: string) => {
    try {
      const updated = await updateSpacePoint(id, pointId, { name })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('画像生成の開始に失敗しました')
    }
  }
  const handleAssign = async (item: Item) => {
    const pointId = pickerPointId
    if (!pointId) return
    setPickerPointId(null)
    try {
      const updated = await updateSpacePoint(id, pointId, { item_id: item.id })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードの割り当てに失敗しました')
    }
  }
  // room キャンバスでのドラッグ確定時に座標を state へ反映（保存は RoomCanvas が行う）
  const handleMovePointXY = useCallback((pointId: string, x: number, y: number) => {
    setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, x, y } : p)))
  }, [setPoints])

  const handleClearCard = async (pointId: string) => {
    try {
      const updated = await updateSpacePoint(id, pointId, { item_id: null })
      setPoints((ps) => ps.map((p) => (p.id === pointId ? updated : p)))
    } catch {
      setError('カードのクリアに失敗しました')
    }
  }
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
    ? '序数のあるポイントを並べ、各点に「名前から画像を生成」または「カードを割り当て」できます（連結法/ジャーニー法）。'
    : '部屋のポイントをドラッグで間取りに配置できます。各ポイントの名前・生成・カード割り当ては下のリストで設定します。'

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/spaces">
        <Button variant="ghost" className="text-sm px-0 mb-4">← スペース一覧へ</Button>
      </Link>

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
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            onBlur={() => setConfirmDelete(false)}
            className="flex items-center gap-1.5 shrink-0"
          >
            <Trash2 size={14} />
            {deleting ? '削除中...' : confirmDelete ? '本当に削除' : '削除'}
          </Button>
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
                key={point.id}
                point={point}
                index={index}
                total={points.length}
                onGenerate={handleGeneratePoint}
                onMove={movePoint}
                onRemove={handleRemovePoint}
                onAssignClick={setPickerPointId}
                onClearCard={handleClearCard}
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

      {pickerPointId && <AssignCardModal onSelect={handleAssign} onClose={() => setPickerPointId(null)} />}
    </div>
  )
}
