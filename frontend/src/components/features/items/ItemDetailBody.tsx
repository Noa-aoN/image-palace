'use client'

import { Trash2, Pencil, Check, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadImage } from '@/lib/download'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { ItemProperties } from '@/components/features/items/ItemProperties'
import { RegeneratePanel } from '@/components/features/items/RegeneratePanel'
import { GenerationInfo } from '@/components/features/items/GenerationInfo'
import { PromptInfo } from '@/components/features/items/PromptInfo'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import { useItemDetail } from '@/hooks/useItemDetail'
import { STATUS_LABEL } from '@/lib/item-status'
import { aspectRatioCss } from '@/lib/aspect-ratio'

// カード詳細の本体（画像・タイトル編集・再生成・プロパティ・生成情報）。
// 詳細ページと右パネルの両方から使えるよう、前後ナビ・パンくずは含めない。
// onDeleted を渡した場合のみ削除ボタンを表示する（渡さなければ削除は出さない）。
export function ItemDetailBody({ itemId, onDeleted }: { itemId: string; onDeleted?: () => void }) {
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
  } = useItemDetail(itemId, { onDeleted })

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
          className="group relative w-full overflow-hidden rounded-xl bg-muted"
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
          {/* ダウンロード（ホバーで表示） */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadImage(item.media!.url!, item.title)
            }}
            aria-label="画像をダウンロード"
            title="画像をダウンロード"
            className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Download size={16} />
          </button>
        </div>
      ) : (
        <GeneratingOverlay
          status={item.generation_status}
          label={imgError ? '画像を表示できません' : STATUS_LABEL[item.generation_status]}
          className="w-full rounded-xl text-muted-foreground"
          style={{ aspectRatio: aspectRatioCss(item?.aspect_ratio) }}
          textClassName="text-sm"
        />
      )}

      {/* 画像まわりの操作と情報。画像を見る面積を削らないよう一行に収める */}
      <div className="flex items-center justify-end gap-3 overflow-x-auto">
        {(item.generation_status === 'failed' || item.generation_status === 'completed') && (
          <RegeneratePanel item={item} onUpdated={applyUpdated} />
        )}
        <PromptInfo item={item} onUpdated={applyUpdated} />
        <GenerationInfo item={item} />
      </div>

      {/* プロパティ */}
      <ItemProperties item={item} onUpdated={applyUpdated} />

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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadImage(item.media!.url!, item.title)
            }}
            aria-label="画像をダウンロード"
            title="画像をダウンロード"
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm text-white transition-colors hover:bg-white/25"
          >
            <Download size={16} />
            ダウンロード
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.media.url} alt={item.title} className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
