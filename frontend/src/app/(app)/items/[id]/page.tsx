'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItem, getItems, deleteItem, retryItem } from '@/lib/api/items'
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
  const [item, setItem] = useState<Item | null>(null)
  const [allIds, setAllIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  const cachedItems = useItemsStore((s) => s.items)

  // Effect 1: カード本体の取得（id 変化時のみ）
  useEffect(() => {
    setImgError(false)
    getItem(id).then(setItem).catch(() => setError('カードの取得に失敗しました'))
  }, [id])

  // Effect 2: allIds 管理（キャッシュが有効なら即反映、なければ fetch）
  useEffect(() => {
    const cacheValid = cachedItems.length > 0 && cachedItems.some((i) => i.id === id)
    if (cacheValid) {
      setAllIds(cachedItems.map((i) => i.id))
    } else {
      getItems()
        .then((items) => {
          setAllIds(items.map((i) => i.id))
          useItemsStore.getState().setItems(items)
        })
        .catch(() => {})
    }
  }, [id, cachedItems])

  // Effect 3: pending/processing 中はポーリング
  const generationStatus = item?.generation_status
  useEffect(() => {
    if (!generationStatus) return
    if (!POLLING_STATUSES.has(generationStatus)) return
    const timer = setInterval(() => {
      getItem(id).then(setItem).catch(() => clearInterval(timer))
    }, 2000)
    return () => clearInterval(timer)
  }, [id, generationStatus])

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
      router.push('/items')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const updated = await retryItem(id)
      setItem(updated)
    } catch {
      setError('再生成の開始に失敗しました')
    } finally {
      setRetrying(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/items"><Button variant="outline">← マイカードへ戻る</Button></Link>
      </div>
    )
  }

  if (!item) {
    return <p className="max-w-lg mx-auto px-6 py-12 text-muted-foreground text-sm">読み込み中...</p>
  }

  const navBtnBase = 'flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-black/8 transition-colors'

  return (
    <div className="relative flex flex-col min-h-full">

      {/* ── デスクトップ専用: 絶対配置でページ端 ── */}
      {prevId && (
        <button
          onClick={() => router.push(`/items/${prevId}`)}
          className={`hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 ${navBtnBase}`}
          aria-label="前のカード"
        >
          <ChevronLeft size={28} strokeWidth={1.5} />
        </button>
      )}
      {nextId && (
        <button
          onClick={() => router.push(`/items/${nextId}`)}
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
          <Link href="/items">
            <Button variant="ghost" className="text-sm px-0">← マイカードへ戻る</Button>
          </Link>
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm"
            onBlur={() => setConfirmDelete(false)}
          >
            <Trash2 size={14} />
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
              <button onClick={() => router.push(`/items/${prevId}`)} className={navBtnBase} aria-label="前のカード">
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
                onClick={() => setZoomed(true)}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full aspect-square rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-sm">
                {imgError ? '画像を表示できません' : (STATUS_LABEL[item.generation_status] ?? item.generation_status)}
              </div>
            )}
          </div>

          {/* 右矢印スロット: モバイルのみ表示 */}
          <div className="w-8 shrink-0 flex justify-center md:hidden">
            {nextId && (
              <button onClick={() => router.push(`/items/${nextId}`)} className={navBtnBase} aria-label="次のカード">
                <ChevronRight size={22} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* タイトル + ステータス */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{item.title}</h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLOR[item.generation_status] ?? ''}`}>
            {STATUS_LABEL[item.generation_status] ?? item.generation_status}
          </span>
        </div>

        {/* 失敗時: 再生成ボタン */}
        {item.generation_status === 'failed' && (
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full flex items-center justify-center gap-2"
          >
            <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
            {retrying ? '再生成を開始中...' : '再生成する（クレジット消費なし）'}
          </Button>
        )}

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
