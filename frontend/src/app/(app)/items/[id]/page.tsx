'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ItemProperties } from '@/components/features/items/ItemProperties'
import { RegeneratePanel } from '@/components/features/items/RegeneratePanel'
import { GenerationInfo } from '@/components/features/items/GenerationInfo'
import { getItem, getItems, deleteItem, updateItem } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
import type { Item } from '@/types/item'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABEL, POLLING_STATUSES } from '@/lib/item-status'
import { StatusBadge } from '@/components/features/items/StatusBadge'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const backHref = '/items'
  const backLabel = '← カードへ戻る'
  const itemHref = (targetId: string) => `/items/${targetId}`
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

    getItems()
      .then((items) => {
        setAllIds(items.map((current) => current.id))
        useItemsStore.getState().setItems(items)
      })
      .catch(() => {})
  }, [cachedItems])

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
      router.push(backHref)
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
        <Skeleton className="h-9 w-32" />
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
    )
  }

  const navBtnBase = 'flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-black/8 transition-colors'

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
          <Breadcrumb className="mb-0" items={[{ href: backHref, label: 'カード' }, { label: item.title }]} />
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

        {/* タイトル + ステータス（テキストを画像の上に表示） */}
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
            <StatusBadge status={item.generation_status} size="lg" />
          </div>
        )}

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
              <div
                className="w-full overflow-hidden rounded-xl bg-muted"
                style={item.media.blur ? { backgroundImage: `url("${item.media.blur}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.media.url}
                  alt={item.title}
                  className="w-full rounded-xl object-cover cursor-zoom-in"
                  decoding="async"
                  fetchPriority="high"
                  onClick={() => setZoomed(true)}
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <GeneratingOverlay
                status={item.generation_status}
                label={imgError ? '画像を表示できません' : STATUS_LABEL[item.generation_status]}
                className="w-full aspect-square rounded-xl text-muted-foreground"
                textClassName="text-sm"
              />
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

        {/* 生成情報: メタ情報なので常時表示せず ⓘ ボタンのクリックで開く */}
        <div className="flex justify-end">
          <GenerationInfo item={item} />
        </div>

        {/* 再生成パネル: failed・completed どちらからも指示付きで再生成できる */}
        {(item.generation_status === 'failed' || item.generation_status === 'completed') && (
          <RegeneratePanel
            item={item}
            onUpdated={(updated) => {
              setItem(updated)
              upsertItem(updated)
            }}
          />
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
