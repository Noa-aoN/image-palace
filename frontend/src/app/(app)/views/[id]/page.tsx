'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { getViewDetail, updateView, deleteView, uploadViewCover, removeViewCover, generateViewCover } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import { usePendingRefresh } from '@/hooks/usePendingRefresh'
import type { ViewDetail } from '@/types/view'
import type { CoverType } from '@/types/cover'

// キャンバスはクライアント専用（React Flow 等の重い依存を含む）。
// サーバ Worker のバンドルから外すため ssr:false で遅延読込する。
const canvasLoading = () => <div className="h-[60vh] animate-pulse rounded-xl bg-muted" />
const FreeboardCanvas = dynamic(
  () => import('@/components/features/views/FreeboardCanvas').then((m) => m.FreeboardCanvas),
  { ssr: false, loading: canvasLoading }
)
const SpaceMapCanvas = dynamic(
  () => import('@/components/features/views/SpaceMapCanvas').then((m) => m.SpaceMapCanvas),
  { ssr: false, loading: canvasLoading }
)
const DeckBoard = dynamic(
  () => import('@/components/features/views/DeckBoard').then((m) => m.DeckBoard),
  { ssr: false, loading: canvasLoading }
)
import { useCoverGeneration } from '@/hooks/useCoverGeneration'
import { AiEditPanel } from '@/components/features/views/AiEditPanel'
import { CoverLauncher } from '@/components/features/shared/CoverLauncher'
import { isSubmitEnter } from '@/lib/enter-key'
import { useItemsStore } from '@/stores/items'

export default function ViewEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [view, setView] = useState<ViewDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /*
    生成中のカードやポイントがある間だけ取り直す。
    配置したカードは非同期に画像が作られるので、これが無いと開いたまま待っても
    完成した絵が現れない。

    種別で持ち方が違う（freeboard は items、space_map は points）ため、
    生成状態を持つものだけを平坦に集める。
    毎回新しい配列を作ると参照が変わってタイマーが張り直されるので、
    view が変わったときだけ作り直す。
  */
  // このキャンバスを開いている間に作られたカード。
  //
  // **作った直後のカードは、まだ view の中に居ない。** 置くのは作ってからなので、
  // view だけを見張っていると、絵ができても取り直しが走らず、
  // 置いたあともずっと「生成中」のままに見える。
  //
  // 作成フォームは作ったカードを控えへ入れるので、それも見張りの対象にする。
  // ただし**この画面を開いてから作られたものだけ**にする。控えには前の画面で
  // 作ったものも残っていて、その中に生成中で終わったものがあると、
  // このキャンバスと関係のない取り直しが永久に続く
  const openedAt = useRef(Date.now())
  const createdItems = useItemsStore((state) => state.items)
  const recentlyCreated = useMemo(
    () => createdItems.filter((item) => new Date(item.created_at).getTime() >= openedAt.current),
    [createdItems]
  )
  const [tick, setTick] = useState(0)

  const generatables = useMemo(
    () => [
      ...(view?.items?.map((placement) => placement.item) ?? []),
      ...(view?.points ?? []).flatMap((point) =>
        point.placed_item ? [point, point.placed_item] : [point]
      ),
      ...recentlyCreated,
    ],
    // tick は中身に影響しないが、**取り直すたびに参照を新しく**するために要る
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, recentlyCreated, tick]
  )
  const refreshView = useCallback(() => {
    getViewDetail(id)
      .then((data) => {
        setView(data)
        // 取り直した回数。**見張りを次へ進めるための目印**。
        //
        // 見張りは「渡した並びが変われば次の回を予約する」作りになっている。
        // このキャンバスに置く前のカード（作った直後）は view の中に居ないので、
        // view だけを取り直しても並びが変わらず、1回で止まっていた。
        setTick((n) => n + 1)
      })
      .catch(() => {
        // 一時的な失敗は次の回で拾う
      })
  }, [id])
  usePendingRefresh(generatables, refreshView)

  useEffect(() => {
    let cancelled = false
    getViewDetail(id)
      .then((data) => {
        if (cancelled) return
        setView(data)
        // 枚数は見出しの隣に出す。デッキ以外では出さない（並びの意味が違う）
        if (data.view_type === 'deck') setDeckCount(data.items?.length ?? 0)
        if (data.view_type === 'freeboard') {
          useBoardSettingsStore.getState().init(data.id, data.settings, data.background_image?.url ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('キャンバスの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !view) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateView(id, { name: trimmed })
      setView((prev) => (prev ? { ...prev, name: updated.name } : prev))
      setEditing(false)
    } catch {
      setError('キャンバス名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteView(id)
      router.push('/views')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // カバー設定（デッキ踏襲。候補は配置したカード）
  const [coverBusy, setCoverBusy] = useState(false)
  // AI編集の結果を盤へ映すための作り直しの鍵
  const [canvasKey, setCanvasKey] = useState(0)
  /**
   * デッキの枚数。**見出しの隣に出す。**
   *
   * 持ち主は DeckBoard（増減するのはそこでの操作）だが、出す場所は見出しなので
   * ここで受ける。null は「デッキではない／まだ分からない」で、そのときは出さない。
   */
  const [deckCount, setDeckCount] = useState<number | null>(null)
  const handleSetCoverType = async (coverType: CoverType) => {
    if (!view || view.cover_type === coverType) return
    setCoverBusy(true)
    try {
      const updated = await updateView(id, { cover_type: coverType })
      setView((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setError('カバー表示の変更に失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }
  const handleUploadCover = async (file: File) => {
    if (!view) return
    setCoverBusy(true)
    try {
      const updated = await uploadViewCover(id, file)
      setView((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setError('画像のアップロードに失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }
  // カバー画像を AI で作る（非同期・1クレジット）。出来上がるまで取り直す
  const reloadCover = useCallback(async () => {
    const data = await getViewDetail(id)
    setView((prev) => (prev ? { ...prev, ...data } : data))
  }, [id])
  const cover = useCoverGeneration({
    status: view?.cover_generation_status,
    statusError: view?.cover_generation_error,
    submit: async (prompt, style) => {
      const updated = await generateViewCover(id, prompt, style)
      setView((prev) => (prev ? { ...prev, ...updated } : prev))
    },
    reload: reloadCover,
  })

  const handleRemoveCover = async () => {
    if (!view) return
    setCoverBusy(true)
    try {
      const updated = await removeViewCover(id)
      setView((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setError('画像の削除に失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }

  if (error && !view) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/views"><Button variant="outline">← キャンバス一覧へ</Button></Link>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-[60vh] w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col min-h-full w-full px-6 py-12 ${
        view.view_type === 'freeboard' ? '' : 'max-w-7xl mx-auto'
      }`}
    >
      <Breadcrumb className="self-start" items={[{ href: '/views', label: 'キャンバス' }, { label: view.name }]} />

      <div className="flex items-center justify-between gap-3 mb-6">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (isSubmitEnter(e)) { e.preventDefault(); handleSaveName() } if (e.key === 'Escape') setEditing(false) }}
              disabled={saving}
              autoFocus
              aria-label="キャンバス名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{view.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{viewTypeLabel(view.view_type)}</span>
            {/* 枚数は**見出しの隣**。操作の行に置くと、操作の一部として読まれる。
                中で増減するので、デッキから知らせてもらう */}
            {deckCount !== null && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                {deckCount} 枚
              </span>
            )}
            <button
              onClick={() => { setNameDraft(view.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="キャンバス名を編集"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
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

      {/* カバー（ヘッダー）。設定一式は右パネルで開く */}
      <CoverLauncher
        cover={view}
        coverType={view.cover_type}
        busy={coverBusy}
        hasCustom={!!view.cover_image}
        helpText="先頭/コラージュ: キャンバスに配置したカードを使用 / カスタム: アップロード画像"
        onSelectType={handleSetCoverType}
        onUpload={handleUploadCover}
        onRemove={handleRemoveCover}
        onGenerate={cover.generate}
        generating={cover.generating}
        generateError={cover.error}
      />

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* キャンバスタイプごとの描画（freeboard / space_map を実装済み） */}
      {view.view_type === 'freeboard' ? (
        <AiEditPanel
          viewId={view.id}
          viewType={view.view_type}
          viewName={view.name}
          canUndo={view.revision?.can_undo ?? false}
          canRedo={view.revision?.can_redo ?? false}
          onApplied={(updated) => {
            setView(updated)
            setCanvasKey((n) => n + 1)
          }}
        >
          {({ editAction, historyActions }) => (
            <FreeboardCanvas
              key={canvasKey}
              viewId={view.id}
              viewName={view.name}
              initialItems={view.items ?? []}
              initialShapes={view.shapes ?? []}
              initialEdges={view.edges ?? []}
              aiEditAction={editAction}
              aiEditHistoryActions={historyActions}
            />
          )}
        </AiEditPanel>
      ) : view.view_type === 'deck' ? (
        /* AI の操作はデッキのツールバーへ差し込む。
           独立した行に置くと、同じキャンバスへの操作が2段に分かれる
           （ボードと同じ形にする） */
        <AiEditPanel
          viewId={view.id}
          viewType={view.view_type}
          viewName={view.name}
          canUndo={view.revision?.can_undo ?? false}
          canRedo={view.revision?.can_redo ?? false}
          onApplied={(updated) => {
            setView(updated)
            setDeckCount(updated.items?.length ?? 0)
            setCanvasKey((n) => n + 1)
          }}
        >
          {({ editAction, historyActions }) => (
            <DeckBoard
              key={canvasKey}
              viewId={view.id}
              initialItems={view.items ?? []}
              cardList={view.card_list}
              aiEditAction={editAction}
              aiEditHistoryActions={historyActions}
              onCountChange={setDeckCount}
              // 出す項目を変えたら、札の中身はサーバーが解決して返す。取り直す
              onLayoutSaved={refreshView}
            />
          )}
        </AiEditPanel>
      ) : view.view_type === 'space_map' ? (
        <SpaceMapCanvas viewId={view.id} space={view.space} initialPoints={view.points ?? []} />
      ) : (
        <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center gap-2 rounded-xl border border-border text-center">
          <p className="text-base font-medium">{viewTypeLabel(view.view_type)}は準備中です</p>
          <p className="text-sm text-muted-foreground">この種別の編集画面は今後実装予定です。</p>
        </div>
      )}
    </div>
  )
}
