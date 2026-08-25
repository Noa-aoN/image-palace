import { useEffect, useState } from 'react'
import { getItem, deleteItem, updateItem } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
import { POLLING_STATUSES } from '@/lib/item-status'
import type { Item } from '@/types/item'

// 取り直すまでの間。すぐ叩き直しても同じ結果になりやすい
const RETRY_DELAY_MS = 800

// カード詳細の共通ロジック（取得・ポーリング・タイトル編集・削除・画像拡大）。
// 詳細ページ（items/[id]）と右パネル（ItemDetailBody）で共有し、レイアウトは各自が持つ。
export function useItemDetail(itemId: string, opts?: { onDeleted?: () => void }) {
  const cachedItems = useItemsStore((s) => s.items)
  const upsertItem = useItemsStore((s) => s.upsertItem)
  const removeItem = useItemsStore((s) => s.removeItem)
  const cachedItem = cachedItems.find((current) => current.id === itemId) ?? null

  const [item, setItem] = useState<Item | null>(() => cachedItem)
  /**
   * このカードを**最後まで読めたか**。
   *
   * 開いた直後に出せるのは一覧の要約（見出し語・状態・絵だけ）で、
   * 項目も意味も並び順も入っていない。それを「空」として描くと、
   * 読み終えた瞬間に色が変わり、項目が現れ、並びが入れ替わる。
   *
   * **「まだ読めていない」と「無い」は別のこと。** 画面がそれを区別できるように、
   * ここで持つ（要約に何が入っているかを画面に推測させない）。
   */
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 読み直しの合図。増やすと取得の effect がもう一度走る
  const [reloadKey, setReloadKey] = useState(0)
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

  // 本体の取得（itemId 変化時）。
  //
  // **一度の失敗で行き止まりにしない。** 作った直後に開くと、通信の間や
  // 反映の間に合わなさで1回だけ失敗することがある。そこで諦めると
  // 「ページが無い」ように見えて、利用者は自分で読み直すしかなくなる。
  // 一拍おいて1度だけ試し直す（取得は読むだけなので、繰り返しても害が無い）。
  useEffect(() => {
    let cancelled = false
    setImgError(false)
    setError(null)
    // 別のカードへ移ったら、また読めていない状態から始める
    setLoaded(false)

    const load = (retriesLeft: number) => {
      getItem(itemId)
        .then((fetched) => {
          if (cancelled) return
          setItem(fetched)
          setLoaded(true)
          upsertItem(fetched)
        })
        .catch(() => {
          if (cancelled) return
          if (retriesLeft > 0) {
            setTimeout(() => load(retriesLeft - 1), RETRY_DELAY_MS)
            return
          }
          setError('カードを読み込めませんでした')
        })
    }

    load(1)
    return () => {
      cancelled = true
    }
  }, [itemId, upsertItem, reloadKey])

  // 読めなかったときに、その場で取り直す。
  // ページ全体の再読み込みと違い、開いている一覧や選択位置を捨てずに済む。
  const reload = () => {
    setError(null)
    setReloadKey((current) => current + 1)
  }

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
    /** 最後まで読めたか。**「まだ読めていない」を「空」として描かないために使う** */
    loaded,
    error,
    reload,
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
