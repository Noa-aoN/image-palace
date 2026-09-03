'use client'

import { Trash2, Pencil, Check, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadImage } from '@/lib/download'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import { PropertyBlock, BlockAction, BlockError } from '@/components/features/items/PropertyBlock'
import { ItemProperties } from '@/components/features/items/ItemProperties'
import { ItemImageBar } from '@/components/features/items/ItemImageBar'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import {
  RegeneratingOverlay,
  REGENERATING_IMAGE_CLASS,
} from '@/components/features/items/RegeneratingOverlay'
import { SafeguardVeil, useSafeguardImage } from '@/components/features/items/SafeguardVeil'
import { SafeguardBar } from '@/components/features/items/SafeguardBar'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import { useItemDetail } from '@/hooks/useItemDetail'
import { STATUS_LABEL, isRegenerating } from '@/lib/item-status'
import { aspectRatioCss } from '@/lib/aspect-ratio'
import { isSubmitEnter } from '@/lib/enter-key'
import type { Item } from '@/types/item'

// カード詳細の本体（画像・タイトル編集・再生成・プロパティ・生成情報）。
// 詳細ページと右パネルの両方から使えるよう、前後ナビ・パンくずは含めない。
// onDeleted を渡した場合のみ削除ボタンを表示する（渡さなければ削除は出さない）。
export function ItemDetailBody({
  itemId,
  onDeleted,
}: {
  itemId: string
  onDeleted?: () => void
}) {
  const {
    item,
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
  } = useItemDetail(itemId, { onDeleted })

  // 覆いの濃さは設定で変えられる（薄い / 標準 / 濃い）。
  // **早期 return より前で呼ぶ**（hook は毎回同じ順で呼ばれないといけない）
  const safeguard = useSafeguardImage()

  // **ここも行き止まりにしない。** 詳細ページ側（items/[id]）には復帰の手があるのに、
  // 右パネルから開いたときだけ文字が出て終わりだった。読めなかった理由は同じなので、
  // 同じように取り直せるようにする。
  if (error) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          通信が途切れただけかもしれません。もう一度お試しください。
        </p>
        <Button size="sm" onClick={reload}>読み込み直す</Button>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <Skeleton className="h-6 w-40" />
      </div>
    )
  }

  // 前の画像が残ったまま生成中＝作り直し中
  const regenerating = isRegenerating(item.generation_status, Boolean(item.media?.url) && !imgError)
  // セーフガードの承認待ち。作り直し中はそちらの見せ方を優先する
  const veiled = Boolean(item.media?.needs_approval) && !regenerating

  return (
    <div className="space-y-5">
      {/*
        見出し語も、下のプロパティと同じ薄い枠に載せる。
        カードが持つものはどれも同じ形で並ぶ、という見え方に揃えるため。
      */}
      <PropertyBlock
        title="見出し語"
        actions={
          !editing && (
            <BlockAction icon={<Pencil size={14} />} label="単語を編集" onClick={startEdit} hideLabel />
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
                  if (isSubmitEnter(e)) {
                    e.preventDefault()
                    handleSaveTitle()
                  }
                  if (e.key === 'Escape') cancelEdit()
                }}
                disabled={saving}
                autoFocus
                aria-label="見出し語"
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
            <BlockError message={editError} />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-lg font-semibold">{item.title}</h2>
            <StatusBadge status={item.generation_status} />
          </div>
        )}
      </PropertyBlock>

      {/*
        イメージも同じ枠に載せる。周りの余白は、あとで台紙やフレームを
        差し替えられるよう、画像そのものではなくこの枠側に持たせる。
      */}
      <PropertyBlock title="イメージ">
        {item.media?.url && !imgError ? (
          <div
            className="group relative w-full overflow-hidden rounded-lg bg-muted"
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
              className={`w-full rounded-lg object-cover ${regenerating ? REGENERATING_IMAGE_CLASS : ''} ${
                veiled ? safeguard.className : 'cursor-zoom-in'
              }`}
              style={veiled ? safeguard.style : undefined}
              // 覆っている間は**掴めなくする**。ブラウザの引きずりは
              // 元の画像そのものを持ち上げるので、ぼかしを外した絵が見えてしまう
              draggable={!veiled}
              decoding="async"
              onClick={() => !veiled && setZoomed(true)}
              onError={() => setImgError(true)}
            />
            {regenerating && <RegeneratingOverlay />}
            {veiled && <SafeguardVeil />}
            <Tooltip label="画像をダウンロード">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadImage(item.media!.url!, item.title)
                }}
                aria-label="画像をダウンロード"
                className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Download size={16} />
              </button>
            </Tooltip>
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

        {/* なぜ失敗したかを、その場で見せる。
            **理由はサーバーが既に用意している**（次に何をすればよいかまで書いてある）のに、
            これまでは右パネルを開かないと読めなかった。開かせる理由が無い */}
        {item.generation_status === 'failed' && item.generation_error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm leading-6 text-destructive">
            {item.generation_error}
          </p>
        )}

        {/* 覆いを外すか、カードごと消すか */}
        {veiled && <SafeguardBar item={item} onUpdated={applyUpdated} onDeleted={onDeleted} />}

        {/* 点検の結果は**絵のすぐ下**に置く。
            指摘を読むのは絵を見ているときで、そこから離すと結び付かない */}
        <ImageCheckNote item={item} />

        {/* イメージへの操作は、イメージの枠の中に収める */}
        <ItemImageBar item={item} onUpdated={applyUpdated} />
      </PropertyBlock>

      {/* プロパティ */}
      {/* 右パネルでしか使わないので、列は選ばせず1列に固定する
          （パネルの幅では2列にすると1列が半分になり、長い項目が読めない） */}
      <ItemProperties item={item} onUpdated={applyUpdated} singleColumn settled={loaded} />

      {/* 詳細ページは「情報」パネルへ寄せたが、右パネルには置き場所が無い
          （パネルの中からパネルを開くことになる）。ここは一行のまま残す */}
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

      {/* 画像拡大。閉じ方（背景・Esc・×）と焦点の戻しは共通の覆いが持つ */}
      <ImageLightbox
        url={item.media?.url}
        alt={item.title}
        open={zoomed}
        onClose={() => setZoomed(false)}
        onDownload={
          item.media?.url ? () => downloadImage(item.media!.url!, item.title) : undefined
        }
      />
    </div>
  )
}

/** 絵と語の噛み合い。**合っているときは出さない**（読むべきものだけを置く） */
const IMAGE_CHECK_LOOK: Record<string, { label: string; className: string }> = {
  weak: { label: '思い出しにくいかもしれません', className: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
  mismatch: { label: '別のものの絵に見えます', className: 'bg-red-50 text-red-900 border-red-200' },
}

function ImageCheckNote({ item }: { item: Item }) {
  const look = item.image_check_status ? IMAGE_CHECK_LOOK[item.image_check_status] : null
  if (!look) return null

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm leading-6 ${look.className}`}>
      <p className="font-medium">{look.label}</p>
      {item.image_check_comment && <p className="mt-0.5 text-xs leading-relaxed">{item.image_check_comment}</p>}
    </div>
  )
}
