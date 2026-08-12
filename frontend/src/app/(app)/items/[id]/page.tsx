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
import { useSettingsStore } from '@/stores/settings'
import { useCardDetailColumns } from '@/hooks/useCardDetailColumns'
import { CardInfoButton } from '@/components/features/items/CardInfoPanel'
import { PropertyBlock, BlockAction } from '@/components/features/items/PropertyBlock'
import { Tooltip } from '@/components/ui/tooltip'
import { useRightPanelStore } from '@/stores/rightPanel'
import { getItemNavigationIds } from '@/lib/api/items'
import { getViewDetail } from '@/lib/api/views'
import { GeneratingOverlay } from '@/components/features/items/GeneratingOverlay'
import {
  RegeneratingOverlay,
  REGENERATING_IMAGE_CLASS,
} from '@/components/features/items/RegeneratingOverlay'
import { SafeguardVeil, SAFEGUARD_IMAGE_CLASS } from '@/components/features/items/SafeguardVeil'
import { SafeguardBar } from '@/components/features/items/SafeguardBar'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABEL, isRegenerating } from '@/lib/item-status'
import { StatusBadge } from '@/components/features/items/StatusBadge'
import { useItemDetail } from '@/hooks/useItemDetail'
import { useMainAreaBox } from '@/hooks/useMainAreaBox'
import { aspectRatioCss } from '@/lib/aspect-ratio'
import { isSubmitEnter } from '@/lib/enter-key'

// 本文領域の端から空ける距離。狭めると本文に食い込み、広げると画面外へ出る
const NAV_INSET = 12

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  // 幅は列数で決める。列を増やしたのは並べて見たいからなので、そのときは広げる
  const defaultColumns = useSettingsStore((s) => s.settings?.card_detail_columns) ?? 1
  const { columns: detailColumns } = useCardDetailColumns(defaultColumns)
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
  // ページ送りの矢印は、本文領域の端から一定の間を空け、見えている高さの中央に置く
  const mainBox = useMainAreaBox()

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
      <div className={`mx-auto w-full px-6 py-12 space-y-3 ${detailColumns >= 2 ? 'max-w-6xl' : 'max-w-lg'}`}>
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

  // 前の画像が残ったまま生成中＝作り直し中
  const regenerating = isRegenerating(item.generation_status, Boolean(item.media?.url) && !imgError)
  // セーフガードの承認待ち。作り直し中はそちらの見せ方を優先する
  const veiled = Boolean(item.media?.needs_approval) && !regenerating

  return (
    <div className="relative flex flex-col min-h-full">

      {/* ── ページ送り: 本文領域の左右端に、見えている高さの中央で置く ──
          中身の中央（absolute top-1/2）に置くと、長いカードでは矢印が画面外まで
          下がってしまう。本文領域そのものを測って、その中央に固定する。

          幅が狭いときも同じ場所に置く。以前は画像の上に重ねていたが、
          そうすると送る場所が画面幅で変わり、押す位置を覚え直すことになる。
          狭いときは中身の上に乗るので、下の字が読めるよう地を敷く */}
      {mainBox && prevId && (
        <button
          onClick={() => router.push(itemHref(prevId))}
          className={`fixed z-10 flex -translate-y-1/2 bg-background/70 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none ${navBtnBase}`}
          style={{ top: mainBox.centerY, left: mainBox.left + NAV_INSET }}
          aria-label="前のカード"
        >
          <ChevronLeft className="size-6 md:size-7" strokeWidth={1.5} />
        </button>
      )}
      {mainBox && nextId && (
        <button
          onClick={() => router.push(itemHref(nextId))}
          className={`fixed z-10 flex -translate-y-1/2 bg-background/70 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none ${navBtnBase}`}
          style={{ top: mainBox.centerY, right: mainBox.right + NAV_INSET }}
          aria-label="次のカード"
        >
          <ChevronRight className="size-6 md:size-7" strokeWidth={1.5} />
        </button>
      )}

      {/* ── カード詳細コンテンツ ── */}
      {/* 1列のときは読みやすい幅（max-w-lg）で中央に。
          2列以上を選んだのは並べて見たいからなので、そのときは本文の幅いっぱいに広げる。
          狭いままだと、列を増やしても1列が細くなるだけで何も得しない */}
      {/* 札どうしの空きは全部同じにする（space-y-3）。
          見出し語とイメージの間だけ広いと、そこで話が切れているように見える。
          実際は同じ並びの札なので、間隔で群を作らない */}
      <div className={`mx-auto w-full px-6 py-12 space-y-3 ${detailColumns >= 2 ? 'max-w-6xl' : 'max-w-lg'}`}>

        {/* パンくずと操作は行を分ける。同じ行に並べると、題名が長いカードで
            操作が押し出され、カードごとにボタンの位置が変わる。

            上下の空きは同じにする。上だけ詰めると、操作がパンくずにぶら下がって見え、
            パンくずの一部なのか押せるものなのかが読み取りにくい。
            ただし広く取りすぎると、この行だけが浮くので詰める。

            空きはパンくず自身の mb で持つ。親の space-y には任せない。
            Tailwind v4 の space-y-* は :where() で当たるため詳細度が 0 で、
            子に付いた mb-* に負けて効かない（mb-0 のままだと空きが消える）。

            右端に寄せるのは、これがカードの中身ではなく、カードに対する操作だから。
            左端に置くと見出し語と同じ列に並び、読むものと押すものが混ざる。
            -mr-2 は ghost ボタンの右余白を打ち消して、右端を本文の縁に揃えるため */}
        <div>
          <Breadcrumb className="mb-3" items={[{ href: backHref, label: fromViewId ? (fromViewName ?? fromLabel) : 'カード' }, { label: item.title }]} />
          <div className="-mr-2 -mb-1 flex flex-wrap items-center justify-end gap-0.5">
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
            {/* 学習に使わない情報（作成日・状態・ID）はここへ寄せる */}
            <CardInfoButton item={item} />
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
                    if (isSubmitEnter(e)) { e.preventDefault(); handleSaveTitle() }
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
                className="relative w-full overflow-hidden rounded-lg bg-muted"
                style={item.media.blur ? { backgroundImage: `url("${item.media.blur}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.media.url}
                  alt={item.title}
                  className={`w-full rounded-lg object-cover ${regenerating ? REGENERATING_IMAGE_CLASS : ''} ${
                    veiled ? SAFEGUARD_IMAGE_CLASS : 'cursor-zoom-in'
                  }`}
                  decoding="async"
                  fetchPriority="high"
                  onClick={() => !veiled && setZoomed(true)}
                  onError={() => setImgError(true)}
                />
                {regenerating && <RegeneratingOverlay />}
                {veiled && <SafeguardVeil />}
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

          </div>

          {/* 覆いを外すか、カードごと消すか */}
          {veiled && (
            <SafeguardBar item={item} onUpdated={applyUpdated} onDeleted={() => router.push(backHref)} />
          )}

          {/* イメージへの操作は、イメージの枠の中に収める。右パネルと同じ並び */}
          <ItemImageBar item={item} onUpdated={applyUpdated} />
        </PropertyBlock>

        {/* プロパティ（種別・意味） */}
        <ItemProperties item={item} onUpdated={applyUpdated} />


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
