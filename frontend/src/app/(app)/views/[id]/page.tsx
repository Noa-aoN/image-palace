'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, MousePointer2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getView, updateView, deleteView } from '@/lib/api/views'
import type { View } from '@/types/view'

export default function ViewEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getView(id)
      .then((data) => {
        if (!cancelled) setView(data)
      })
      .catch(() => {
        if (!cancelled) setError('ビューの取得に失敗しました')
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
      setView(updated)
      setEditing(false)
    } catch {
      setError('ビュー名の更新に失敗しました')
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

  if (error && !view) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/views"><Button variant="outline">← ビュー一覧へ</Button></Link>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-[60vh] w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full px-6 py-12 max-w-6xl mx-auto w-full">
      <Link href="/views">
        <Button variant="ghost" className="text-sm px-0 mb-4 self-start">← ビュー一覧へ</Button>
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
              aria-label="ビュー名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{view.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">フリーボード</span>
            <button
              onClick={() => { setNameDraft(view.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="ビュー名を編集"
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

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/*
        ボードキャンバス（雛形）
        ドラッグ&ドロップ配置・座標保存・ズーム/パンは #113 で実装予定。
        ここではフリーボードの領域だけを用意している。
      */}
      <div
        className="relative flex-1 min-h-[60vh] rounded-xl border border-border overflow-hidden"
        style={{
          backgroundColor: 'var(--ivory-dark)',
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <MousePointer2 size={28} className="mb-3" style={{ color: 'var(--palace)' }} />
          <p className="text-sm font-medium text-foreground/70">フリーボードは実装中です</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            ここにカードをドラッグ&amp;ドロップで自由配置し、関係性を視覚化できるようになります（#113）。
          </p>
        </div>
      </div>
    </div>
  )
}
