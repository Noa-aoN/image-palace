'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, DoorOpen, ChevronRight, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSpace, updateSpace, deleteSpace } from '@/lib/api/spaces'
import { getRooms, createRoom } from '@/lib/api/rooms'
import { getRoads, createRoad } from '@/lib/api/roads'
import type { Space } from '@/types/space'
import type { Room } from '@/types/room'
import type { Road } from '@/types/road'

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

  const [rooms, setRooms] = useState<Room[]>([])
  const [roads, setRoads] = useState<Road[]>([])

  // スペースに追加するコンテンツの統一フォーム（種別を選んで作成）
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState<'room' | 'road'>('room')
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSpace(id)
      .then((data) => {
        if (!cancelled) setSpace(data)
      })
      .catch(() => {
        if (!cancelled) setError('スペースの取得に失敗しました')
      })
    getRooms(id)
      .then((data) => {
        if (!cancelled) setRooms(data)
      })
      .catch(() => {
        // ルーム取得失敗は致命的でないため握りつぶす
      })
    getRoads(id)
      .then((data) => {
        if (!cancelled) setRoads(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      setCreateError('名前を入力してください')
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      if (newType === 'room') {
        const created = await createRoom(id, trimmed)
        setRooms((current) => [...current, created])
      } else {
        const created = await createRoad(id, trimmed)
        setRoads((current) => [...current, created])
      }
      setNewName('')
      setCreating(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setCreateError(axiosErr?.response?.data?.errors?.[0] ?? '作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

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

      {/* コンテンツ追加（種別を選択） */}
      <div className="mb-8">
        {!creating ? (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            追加
          </Button>
        ) : (
          <form onSubmit={handleCreateChild} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'room' | 'road')}
              disabled={submitting}
              aria-label="種別"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="room">ルーム</option>
              <option value="road">ロード</option>
            </select>
            <div className="flex-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={newType === 'room' ? 'ルーム名（例: 単語、文法）' : 'ロード名（例: 通勤路、家の中）'}
                autoFocus
                disabled={submitting}
                aria-label="名前"
              />
              {createError && <p className="mt-1 text-sm text-destructive">{createError}</p>}
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? '作成中...' : '作成'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setCreating(false); setNewName(''); setCreateError(null) }}
                disabled={submitting}
              >
                キャンセル
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ルーム */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">ルーム</h2>

        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            まだルームがありません。上の「追加」から種別「ルーム」で作成できます。
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/spaces/${id}/rooms/${room.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <DoorOpen size={16} style={{ color: 'var(--palace)' }} />
                  <span className="font-medium text-sm truncate">{room.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                  {room.collection_count} コレクション
                  <ChevronRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ロード（連結法/ジャーニー） */}
      <section className="space-y-3 mt-10">
        <div>
          <h2 className="text-base font-semibold">ロード</h2>
          <p className="text-xs text-muted-foreground">序数のあるポイントを並べ、各点にカードを置く道（連結法）。</p>
        </div>

        {roads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            まだロードがありません。上の「追加」から種別「ロード」で作成できます。
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roads.map((road) => (
              <Link
                key={road.id}
                href={`/spaces/${id}/roads/${road.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Route size={16} style={{ color: 'var(--palace)' }} />
                  <span className="font-medium text-sm truncate">{road.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                  {road.point_count} ポイント
                  <ChevronRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
