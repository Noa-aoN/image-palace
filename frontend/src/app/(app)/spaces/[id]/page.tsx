'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, DoorOpen, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSpace, updateSpace, deleteSpace } from '@/lib/api/spaces'
import { getRooms, createRoom } from '@/lib/api/rooms'
import type { Space } from '@/types/space'
import type { Room } from '@/types/room'

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
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomSubmitting, setRoomSubmitting] = useState(false)
  const [roomError, setRoomError] = useState<string | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [id])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = roomName.trim()
    if (!trimmed) {
      setRoomError('ルーム名を入力してください')
      return
    }
    setRoomSubmitting(true)
    setRoomError(null)
    try {
      const created = await createRoom(id, trimmed)
      setRooms((current) => [...current, created])
      setRoomName('')
      setCreatingRoom(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setRoomError(axiosErr?.response?.data?.errors?.[0] ?? 'ルームの作成に失敗しました')
    } finally {
      setRoomSubmitting(false)
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

      {/* ルーム */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">ルーム</h2>
          {!creatingRoom && (
            <Button variant="outline" size="sm" onClick={() => setCreatingRoom(true)} className="flex items-center gap-1.5">
              <Plus size={14} />
              ルームを追加
            </Button>
          )}
        </div>

        {creatingRoom && (
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="ルーム名（例: 単語、文法）"
                autoFocus
                disabled={roomSubmitting}
                aria-label="ルーム名"
              />
              {roomError && <p className="mt-1 text-sm text-destructive">{roomError}</p>}
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={roomSubmitting}>
                {roomSubmitting ? '作成中...' : '作成'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setCreatingRoom(false); setRoomName(''); setRoomError(null) }}
                disabled={roomSubmitting}
              >
                キャンセル
              </Button>
            </div>
          </form>
        )}

        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            まだルームがありません。「ルームを追加」でテーマ別の空間を作りましょう。
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
    </div>
  )
}
