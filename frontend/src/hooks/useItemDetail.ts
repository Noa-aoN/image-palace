import { useEffect, useState } from 'react'
import { getItem, deleteItem, updateItem } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
import { POLLING_STATUSES } from '@/lib/item-status'
import type { Item } from '@/types/item'

// カード詳細の共通ロジック（取得・ポーリング・タイトル編集・削除・画像拡大）。
// 詳細ページ（items/[id]）と右パネル（ItemDetailBody）で共有し、レイアウトは各自が持つ。
export function useItemDetail(itemId: string, opts?: { onDeleted?: () => void }) {
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

  // ストア更新（他画面での更新）を反映
  useEffect(() => {
    if (cachedItem) setItem(cachedItem)
  }, [cachedItem])

  useEffect(() => {
    setImgError(false)
  }, [item?.media?.url])

  // 本体の取得（itemId 変化時）
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

  // 画像拡大中は ESC で閉じる
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
      opts?.onDeleted?.()
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

  // onUpdated（RegeneratePanel / ItemProperties 用）
  const applyUpdated = (updated: Item) => {
    setItem(updated)
    upsertItem(updated)
  }

  return {
    item,
    error,
    imgError,
    setImgError,
    deleting,
    confirmDelete,
    setConfirmDelete,
    zoomed,
    setZoomed,
    editing,
    titleDraft,
    setTitleDraft,
    saving,
    editError,
    handleDelete,
    startEdit,
    cancelEdit,
    handleSaveTitle,
    applyUpdated,
  }
}
