'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Trash2, ChevronLeft, ChevronRight, RefreshCw, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ItemProperties } from '@/components/features/items/ItemProperties'
import { getItem, getItems, deleteItem, retryItem, updateItem } from '@/lib/api/items'
import { getDeck } from '@/lib/api/decks'
import { useItemsStore } from '@/stores/items'
import type { Item } from '@/types/item'

const STATUS_LABEL: Record<string, string> = {
  pending: '生成待ち',
  processing: '生成中',
  completed: '完了',
  failed: '失敗',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const POLLING_STATUSES = new Set(['pending', 'processing'])

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  // デッキ経由で開いた場合の文脈（戻り先・前後移動の範囲をそのデッキに揃える）
  const deckId = searchParams.get('deck')
  const backHref = deckId ? `/decks/${deckId}` : '/items'
  const backLabel = deckId ? '← デッキへ戻る' : '← マイカードへ戻る'
  const itemHref = (targetId: string) => (deckId ? `/items/${targetId}?deck=${deckId}` : `/items/${targetId}`)
  const cachedItems = useItemsStore((s) => s.items)
  const upsertItem = useItemsStore((s) => s.upsertItem)
  const removeItem = useItemsStore((s) => s.removeItem)
  const cachedItem = cachedItems.find((current) => current.id === id) ?? null
  const [item, setItem] = useState<Item | null>(() => cachedItem)
  const [allIds, setAllIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedItem) {
      setItem(cachedItem)
    }
  }, [cachedItem])

  useEffect(() => {
    setImgError(false)
  }, [item?.media?.url])

  // Effect 1: カード本体の取得（id 変化時のみ）
  useEffect(() => {
    setImgError(false)
    getItem(id)
      .then((fetched) => {
        setItem(fetched)
        upsertItem(fetched)
      })
      .catch(() => setError('カードの取得に失敗しました'))
  }, [id, upsertItem])

  // Effect 2: allIds 管理（キャッシュがあればそれを優先）
  useEffect(() => {
    if (cachedItems.length > 0) {
      setAllIds(cachedItems.map((i) => i.id))
      return
    }

    // デッキ経由でストア未読込（リロード等）の場合はそのデッキのカードで前後移動する
    if (deckId) {
      getDeck(deckId)
        .then((deck) => {
          setAllIds(deck.items.map((i) => i.id))
          useItemsStore.getState().setItems(deck.items)
        })
        .catch(() => {})
      return
    }

    getItems()
      .then((items) => {
        setAllIds(items.map((current) => current.id))
        useItemsStore.getState().setItems(items)
      })
      .catch(() => {})
  }, [cachedItems, deckId])

  // Effect 3: pending/processing 中はポーリング
  const generationStatus = item?.generation_status
  useEffect(() => {
    if (!generationStatus) return
    if (!POLLING_STATUSES.has(generationStatus)) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const fetched = await getItem(id)
        if (cancelled) return

        setItem(fetched)
        upsertItem(fetched)

        if (POLLING_STATUSES.has(fetched.generation_status)) {
          timer = setTimeout(poll, 2000)
        }
      } catch {
        if (timer) clearTimeout(timer)
      }
    }

    timer = setTimeout(poll, 2000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id, generationStatus, upsertItem])

  // Effect 4: モーダル表示中は ESC で閉じる
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  const currentIndex = allIds.indexOf(id)
  const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null
  const nextId = currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteItem(id)
      removeItem(id)
      router.push('/items')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    setError(null)
    try {
      const updated = await retryItem(id)
      setItem(updated)
      upsertItem(updated)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      const msg =
        axiosErr?.response?.data?.error ??
        axiosErr?.response?.data?.errors?.[0] ??
        '再生成に失敗しました。もう一度試してください。'
      setError(msg)
    } finally {
      setRetrying(false)
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
      const updated = await updateItem(id, { title: trimmed })
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
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href={backHref}><Button variant="outline">{backLabel}</Button></Link>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="max-w-lg mx-auto w-full px-6 py-12 space-y-6">
        <div className="h-9 w-32 rounded bg-muted animate-pulse" />
        <div className="aspect-square w-full rounded-xl bg-muted animate-pulse" />
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-40 rounded bg-muted animate-pulse" />
          <div className="h-8 w-16 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
    )
  }

  const navBtnBase = 'flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-black/8 transition-colors'
  const isGenerating = POLLING_STATUSES.has(item.generation_status)

  return (
    <div className="relative flex flex-col min-h-full">

      {/* ── デスクトップ専用: 絶対配置でページ端 ── */}
      {prevId && (
        <button
          onClick={() => router.push(itemHref(prevId))}
          className={`hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 ${navBtnBase}`}
          aria-label="前のカード"
        >
          <ChevronLeft size={28} strokeWidth={1.5} />
        </button>
      )}
      {nextId && (
        <button
          onClick={() => router.push(itemHref(nextId))}
          className={`hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 ${navBtnBase}`}
          aria-label="次のカード"
        >
          <ChevronRight size={28} strokeWidth={1.5} />
        </button>
      )}

      {/* ── カード詳細コンテンツ ── */}
      <div className="max-w-lg mx-auto w-full px-6 py-12 space-y-6">

        {/* ヘッダー行 */}
        <div className="flex items-center justify-between">
          <Link href={backHref}>
            <Button variant="ghost" className="text-sm px-0">{backLabel}</Button>
          </Link>
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

        {/*
          ── 画像 + ナビゲーション ──
          モバイル (<md): flex row で [←][画像][→]
          デスクトップ (≥md): 矢印スロットを hidden にして画像フル幅
        */}
        <div className="flex items-center gap-1 -mx-2 md:mx-0">
          {/* 左矢印スロット: モバイルのみ表示 */}
          <div className="w-8 shrink-0 flex justify-center md:hidden">
            {prevId && (
              <button onClick={() => router.push(itemHref(prevId))} className={navBtnBase} aria-label="前のカード">
                <ChevronLeft size={22} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* 画像 */}
          <div className="flex-1 min-w-0 md:flex-none md:w-full">
            {item.media?.url && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.media.url}
                alt={item.title}
                className="w-full rounded-xl object-cover cursor-zoom-in"
                decoding="async"
                fetchPriority="high"
                onClick={() => setZoomed(true)}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="relative w-full aspect-square rounded-xl bg-muted flex items-center justify-center overflow-hidden text-muted-foreground text-sm">
                {isGenerating && (
                  <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_42%,rgba(255,255,255,0.14))]" />
                )}
                <span className="relative z-10">
                  {imgError ? '画像を表示できません' : (STATUS_LABEL[item.generation_status] ?? item.generation_status)}
                </span>
              </div>
            )}
          </div>

          {/* 右矢印スロット: モバイルのみ表示 */}
          <div className="w-8 shrink-0 flex justify-center md:hidden">
            {nextId && (
              <button onClick={() => router.push(itemHref(nextId))} className={navBtnBase} aria-label="次のカード">
                <ChevronRight size={22} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* タイトル + ステータス */}
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle() }
                  if (e.key === 'Escape') cancelEdit()
                }}
                disabled={saving}
                autoFocus
                aria-label="タイトル"
                className="text-lg"
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl font-semibold truncate">{item.title}</h1>
              <button
                onClick={startEdit}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="タイトルを編集"
              >
                <Pencil size={16} />
              </button>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}>
              {STATUS_LABEL[item.generation_status] ?? item.generation_status}
            </span>
          </div>
        )}

        {/* 失敗時: 再生成ボタン */}
        {item.generation_status === 'failed' && (
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={retrying}
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
              {retrying ? '再生成を開始中...' : '再生成する（クレジット消費なし）'}
            </Button>
            {item.generation_error && (
              <p className="text-sm leading-6 text-destructive">{item.generation_error}</p>
            )}
          </div>
        )}

        {/* プロパティ（種別・意味） */}
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
      </div>

      {/* 位置インジケーター: ページ最下部・中央 */}
      {allIds.length > 1 && currentIndex >= 0 && (
        <div className="mt-auto pb-6 text-center text-xs text-muted-foreground">
          {currentIndex + 1} / {allIds.length}
        </div>
      )}

      {/* 画像拡大モーダル */}
      {zoomed && item.media?.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out p-4"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.media.url}
            alt={item.title}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        </div>
      )}

    </div>
  )
}
