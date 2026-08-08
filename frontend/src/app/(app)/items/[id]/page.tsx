'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Trash2, ChevronLeft, ChevronRight, Pencil, Check, X, ExternalLink, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ItemProperties } from '@/components/features/items/ItemProperties'
import { ItemImageBar } from '@/components/features/items/ItemImageBar'
import { CARD_VIEW_PANEL_KEY } from '@/components/features/items/CardViewPanel'
import { PropertyBlock, BlockAction } from '@/components/features/items/PropertyBlock'
import { Tooltip } from '@/components/ui/tooltip'
import { useRightPanelStore } from '@/stores/rightPanel'
import { getItemNavigationIds } from '@/lib/api/items'
import { getViewDetail } from '@/lib/api/views'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABEL } from '@/lib/item-status'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import { useItemDetail } from '@/hooks/useItemDetail'
import { aspectRatioCss } from '@/lib/aspect-ratio'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const openSection = useRightPanelStore((s) => s.openSection)
  const searchParams = useSearchParams()
  // デッキ/ボード経由で開いた場合は元の view を保持し、前後ナビをその並び順（view 由来）に切り替える。
  const deckId = searchParams.get('deck')
  const boardId = searchParams.get('board')
  const fromViewId = deckId ?? boardId
  const fromParam = deckId ? `deck=${deckId}` : boardId ? `board=${boardId}` : null
  const fromLabel = deckId ? 'デッキ' : boardId ? 'ボード' : 'カード'
  const [fromViewName, setFromViewName] = useState<string | null>(null)
  const backHref = fromViewId ? `/views/${fromViewId}` : '/items'
  const backLabel = fromViewId ? `← ${fromLabel}へ戻る` : '← カードへ戻る'
  // 前後移動でも文脈を維持するため、遷移先 URL に元のクエリを引き継ぐ。
  const itemHref = (targetId: string) =>
    fromParam ? `/items/${targetId}?${fromParam}` : `/items/${targetId}`

  const [allIds, setAllIds] = useState<string[]>([])

  // 詳細の状態・操作（取得・ポーリング・タイトル編集・削除・拡大）は共通フックに集約。
  const {
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
  } = useItemDetail(id, { onDeleted: () => router.push(backHref) })

  // 前後ナビ用 ID 一覧。デッキ/ボード経由なら「その view の並び順」を、それ以外はライブラリ全体順を使う。
  useEffect(() => {
    if (fromViewId) {
      getViewDetail(fromViewId)
        .then((view) => {
          setAllIds((view.items ?? []).map((vi) => vi.item_id))
          setFromViewName(view.name)
        })
        .catch(() => {})
    } else {
      getItemNavigationIds()
        .then(setAllIds)
        .catch(() => {})
    }
  }, [fromViewId])

  const currentIndex = allIds.indexOf(id)
  const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null
  const nextId = currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null

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
          <Breadcrumb className="mb-0" items={[{ href: backHref, label: fromViewId ? (fromViewName ?? fromLabel) : 'カード' }, { label: item.title }]} />
          {/* 「表示」と「削除」はどちらもこのカードへの操作。間を詰めて一組に見せる */}
          <div className="flex shrink-0 items-center gap-0.5">
            {/* このカード1枚の見え方（どのブロックを出すか・並び順）。
                中身は ItemProperties 側が右パネルへ差し込む */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openSection({ key: CARD_VIEW_PANEL_KEY, title: '表示' })}
              className="flex items-center gap-1.5 text-sm"
            >
              <LayoutList size={14} />
              表示
            </Button>
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
        </div>

        {/* 見出し語も、下のプロパティと同じ薄い枠に載せて見え方を揃える */}
        <PropertyBlock
          title="見出し語"
          actions={
            !editing && (
              <>
                <BlockAction icon={<Pencil size={16} />} label="単語を編集" onClick={startEdit} hideLabel />
                <Tooltip label="ブラウザで検索（別タブ）">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(item.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="ブラウザで検索（別タブ）"
                  >
                    <ExternalLink size={16} />
                  </a>
                </Tooltip>
              </>
            )
          }
        >
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
                  aria-label="見出し語"
                  className="text-lg"
                />
                <Tooltip label="保存">
                  <Button size="sm" onClick={handleSaveTitle} disabled={saving} aria-label="保存" className="shrink-0">
                    {saving ? <Spinner size={16} /> : <Check size={16} />}
                  </Button>
                </Tooltip>
                <Tooltip label="キャンセル">
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving} aria-label="キャンセル" className="shrink-0">
                    <X size={16} />
                  </Button>
                </Tooltip>
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <h1 className="truncate text-2xl font-semibold">{item.title}</h1>
              <StatusBadge status={item.generation_status} size="lg" />
            </div>
          )}
        </PropertyBlock>

        {/*
          ── 画像 + ナビゲーション ──
          イメージも他のプロパティと同じ幅に揃える。
          以前は左右に矢印スロット（各32px）を並べていたため、モバイルでこのブロックだけ
          狭くなり、カードが持つものが同じ形で並ぶという見え方が崩れていた。
          矢印は画像の上に重ねる（幅を取らない）。
        */}
        <PropertyBlock title="イメージ">
          <div className="relative">
            {item.media?.url && !imgError ? (
              <div
                className="w-full overflow-hidden rounded-lg bg-muted"
                style={item.media.blur ? { backgroundImage: `url("${item.media.blur}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.media.url}
                  alt={item.title}
                  className="w-full cursor-zoom-in rounded-lg object-cover"
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
                className="w-full rounded-lg text-muted-foreground"
                style={{ aspectRatio: aspectRatioCss(item?.aspect_ratio) }}
                textClassName="text-sm"
              />
            )}

            {/* 前後のカードへ。画面が広いときは画像の外に出す余地が無いので、常に重ねる */}
            {prevId && (
              <button
                onClick={() => router.push(itemHref(prevId))}
                className={`${navBtnBase} absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur-sm md:hidden`}
                aria-label="前のカード"
              >
                <ChevronLeft size={22} strokeWidth={1.5} />
              </button>
            )}
            {nextId && (
              <button
                onClick={() => router.push(itemHref(nextId))}
                className={`${navBtnBase} absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur-sm md:hidden`}
                aria-label="次のカード"
              >
                <ChevronRight size={22} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </PropertyBlock>

        {/* 画像まわりの情報と操作（生成情報・プロンプト情報・作り直す）。右パネルと同じ並び */}
        <ItemImageBar item={item} onUpdated={applyUpdated} />

        {/* プロパティ（種別・意味） */}
        <ItemProperties item={item} onUpdated={applyUpdated} />

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
