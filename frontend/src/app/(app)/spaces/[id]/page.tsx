'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSpace, updateSpace, deleteSpace } from '@/lib/api/spaces'
import type { Space } from '@/types/space'

export default function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [space, setSpace] = useState<Space | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
      setSpace(updated)
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/spaces">
        <Button variant="ghost" className="text-sm px-0 mb-4">← スペース一覧へ</Button>
      </Link>

      {editing ? (
        <div className="space-y-3 mb-8">
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={saving}
            autoFocus
            aria-label="スペース名"
            className="text-lg"
          />
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            disabled={saving}
            rows={3}
            placeholder="スペースの説明（任意）"
            aria-label="スペースの説明"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5">
              <Check size={14} />保存
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1.5">
              <X size={14} />キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold truncate">{space.name}</h1>
              <button
                onClick={startEdit}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="スペースを編集"
              >
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

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* ルーム: #115 で実装予定 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">ルーム</h2>
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground/70">近日対応予定</p>
          <p className="mt-1">このスペース内に、コレクションやビューを配置するルームを作れるようになります。</p>
        </div>
      </section>
    </div>
  )
}
