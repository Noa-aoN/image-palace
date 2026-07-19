'use client'

import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { ItemProperties } from '@/components/features/items/ItemProperties'
import { RegeneratePanel } from '@/components/features/items/RegeneratePanel'
import { GenerationInfo } from '@/components/features/items/GenerationInfo'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import { getItem, deleteItem, updateItem } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
import { STATUS_LABEL, POLLING_STATUSES } from '@/lib/item-status'
import type { Item } from '@/types/item'

// カード詳細の本体（画像・タイトル編集・再生成・プロパティ・生成情報）。
// 詳細ページと右パネルの両方から使えるよう、前後ナビ・パンくずは含めない。
// onDeleted を渡した場合のみ削除ボタンを表示する（渡さなければ削除は出さない）。
export function ItemDetailBody({ itemId, onDeleted }: { itemId: string; onDeleted?: () => void }) {
  const cachedItems = useItemsStore((s) => s.items)
  const upsertItem = useItemsStore((s) => s.upsertItem)
  const removeItem = useItemsStore((s) => s.removeItem)
  const cachedItem = cachedItems.find((current) => current.id === itemId) ?? null
  const [item, setItem] = useState<Item | null>(() => cachedItem)
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    setImgError(false)
  }, [item?.media?.url])

  // カード本体の取得（itemId 変化時のみ）
  useEffect(() => {
    setImgError(false)
    setError(null)
    getItem(itemId)
      .then((fetched) => {
        setItem(fetched)
        upsertItem(fetched)
      })
      .catch(() => setError('カードの取得に失敗しました'))
  }, [itemId, upsertItem])

  // pending/processing 中はポーリング
  const generationStatus = item?.generation_status
  useEffect(() => {
    if (!generationStatus) return
    if (!POLLING_STATUSES.has(generationStatus)) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(poll, 10000)
        return
      }
      try {
        const fetched = await getItem(itemId)
        if (cancelled) return
        setItem(fetched)
        upsertItem(fetched)
        if (POLLING_STATUSES.has(fetched.generation_status)) {
          timer = setTimeout(poll, 2000)
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 5000)
      }
    }

    timer = setTimeout(poll, 2000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [itemId, generationStatus, upsertItem])

  // モーダル表示中は ESC で閉じる
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await deleteItem(itemId)
      removeItem(itemId)
      onDeleted?.()
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const startEdit = () => {
    setTitleDraft(item?.title ?? '')
    setEditError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditError(null)
  }

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setEditError('タイトルを入力してください')
      return
    }
    if (trimmed === item?.title) {
      cancelEdit()
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      const updated = await updateItem(itemId, { title: trimmed })
      setItem(updated)
      upsertItem(updated)
      setEditing(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      const msg =
        axiosErr?.response?.data?.errors?.[0] ??
        axiosErr?.response?.data?.error ??
        '更新に失敗しました。もう一度試してください。'
      setEditError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <Skeleton className="h-6 w-40" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* タイトル + ステータス */}
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveTitle()
                }
                if (e.key === 'Escape') cancelEdit()
              }}
              disabled={saving}
              autoFocus
              aria-label="タイトル"
            />
            <Button size="sm" onClick={handleSaveTitle} disabled={saving} aria-label="保存" className="shrink-0">
              {saving ? <Spinner size={16} /> : <Check size={16} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving} aria-label="キャンセル" className="shrink-0">
              <X size={16} />
            </Button>
          </div>
          {editError && <p className="text-sm text-destructive">{editError}</p>}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{item.title}</h2>
            <button
              onClick={startEdit}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="タイトルを編集"
            >
              <Pencil size={15} />
            </button>
          </div>
          <StatusBadge status={item.generation_status} />
        </div>
      )}

      {/* 画像 */}
      {item.media?.url && !imgError ? (
        <div
          className="w-full overflow-hidden rounded-xl bg-muted"
          style={
            item.media.blur
              ? { backgroundImage: `url("${item.media.blur}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.media.url}
            alt={item.title}
            className="w-full cursor-zoom-in rounded-xl object-cover"
            decoding="async"
            onClick={() => setZoomed(true)}
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <GeneratingOverlay
          status={item.generation_status}
          label={imgError ? '画像を表示できません' : STATUS_LABEL[item.generation_status]}
          className="aspect-square w-full rounded-xl text-muted-foreground"
          textClassName="text-sm"
        />
      )}

      {/* 生成情報 */}
      <div className="flex justify-end">
        <GenerationInfo item={item} />
      </div>

      {/* 再生成 */}
      {(item.generation_status === 'failed' || item.generation_status === 'completed') && (
        <RegeneratePanel
          item={item}
          onUpdated={(updated) => {
            setItem(updated)
            upsertItem(updated)
          }}
        />
      )}

      {/* プロパティ */}
      <ItemProperties
        item={item}
        onUpdated={(updated) => {
          setItem(updated)
          upsertItem(updated)
        }}
      />

      <p className="text-sm text-muted-foreground">
        作成日: {new Date(item.created_at).toLocaleDateString('ja-JP')}
      </p>

      {onDeleted && (
        <div className="border-t border-border pt-4">
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm"
            onBlur={() => setConfirmDelete(false)}
          >
            {deleting ? <Spinner size={14} /> : <Trash2 size={14} />}
            {deleting ? '削除中...' : confirmDelete ? '本当に削除' : '削除'}
          </Button>
        </div>
      )}

      {/* 画像拡大モーダル */}
      {zoomed && item.media?.url && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.media.url} alt={item.title} className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
