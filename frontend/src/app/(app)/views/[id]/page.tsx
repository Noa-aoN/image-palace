'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getViewDetail, updateView, deleteView, uploadViewCover, removeViewCover } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import type { ViewDetail } from '@/types/view'
import type { CoverType } from '@/types/cover'
import { FreeboardCanvas } from '@/components/features/views/FreeboardCanvas'
import { SpaceMapCanvas } from '@/components/features/views/SpaceMapCanvas'
import { DeckBoard } from '@/components/features/views/DeckBoard'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { CoverSettings } from '@/components/features/shared/CoverSettings'

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

  useEffect(() => {
    let cancelled = false
    getViewDetail(id)
      .then((data) => {
        if (!cancelled) setView(data)
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
    <div className="flex flex-col min-h-full px-6 py-12 max-w-7xl mx-auto w-full">
      <Link href="/views">
        <Button variant="ghost" className="text-sm px-0 mb-4 self-start">← キャンバス一覧へ</Button>
      </Link>

      <div className="flex items-center justify-between gap-3 mb-6">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveName() } if (e.key === 'Escape') setEditing(false) }}
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

      {/* カバー（ヘッダー）設定 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <EntityCover cover={view} />
        </div>
        <div className="flex-1">
          <CoverSettings
            coverType={view.cover_type}
            busy={coverBusy}
            hasCustom={!!view.cover_image}
            helpText="先頭/コラージュ: キャンバスに配置したカードを使用 / カスタム: アップロード画像"
            onSelectType={handleSetCoverType}
            onUpload={handleUploadCover}
            onRemove={handleRemoveCover}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* キャンバスタイプごとの描画（freeboard / space_map を実装済み） */}
      {view.view_type === 'freeboard' ? (
        <FreeboardCanvas viewId={view.id} initialItems={view.items ?? []} />
      ) : view.view_type === 'deck' ? (
        <DeckBoard viewId={view.id} initialItems={view.items ?? []} />
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
