'use client'

import { ImageIcon, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CoverSettings } from '@/components/features/shared/CoverSettings'
import { useState } from 'react'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import type { CoverType } from '@/types/cover'
import type { ComponentProps, ReactNode } from 'react'

const PANEL_KEY = 'cover-settings'

/**
 * カバーの見た目と、設定を開くボタンだけをページに置く。
 *
 * 設定一式（表示の切替・アップロード・AI生成）はまとめると縦に長く、
 * ページの本題（盤・中身の一覧）を押しのけてしまう。詳細は右パネルへ移す。
 *
 * キャンバス・スペース・ボックスで同じ形にするため、
 * カバーの絵と CoverSettings への受け渡しだけをここでまとめる。
 */
export function CoverLauncher({
  cover,
  fallback,
  generating,
  ...settings
}: {
  /** EntityCover に渡すレコード（cover_type / cover などを持つ） */
  cover: ComponentProps<typeof EntityCover>['cover']
  /** カバー画像が無いときの代わりの見た目（スペースの部屋・道など） */
  fallback?: ComponentProps<typeof EntityCover>['fallback']
  generating?: boolean
  coverType: CoverType
  busy: boolean
  helpText?: string
  hasCustom: boolean
  onSelectType: (type: CoverType) => void
  onUpload: (file: File) => void
  onRemove: () => void
  onGenerate?: (prompt: string, style: string) => void
  generateError?: string | null
}): ReactNode {
  const panel = usePanelForm(PANEL_KEY, 'カバーの設定')
  const [zoomed, setZoomed] = useState(false)
  // 大きく見るときは、一覧用の縮小版ではなく元の絵を出す
  const zoomUrl =
    cover?.cover_image?.url ?? cover?.cover?.url ?? cover?.cover_images?.[0]?.url ?? null

  return (
    <div className="mb-6 flex items-center gap-4">
      {/* 絵の中には切替の矢印（釦）が入るので、**全体を釦で包まない**（釦の入れ子になる）。
          代わりに角へ小さな出口を重ねる。触る画面でも押せるよう、常に出しておく */}
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
        <EntityCover cover={cover} fallback={fallback} />
        {zoomUrl && (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="カバー画像を大きく見る"
            title="大きく見る"
            className="absolute bottom-1 right-1 rounded-md bg-black/45 p-1 text-white opacity-80 transition hover:bg-black/65 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>
      <ImageLightbox
        url={zoomUrl}
        alt="カバー画像"
        open={zoomed}
        onClose={() => setZoomed(false)}
      />
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={panel.open}
          aria-expanded={panel.isOpen}
          className="flex items-center gap-1.5"
        >
          <ImageIcon size={15} />
          カバーを設定
        </Button>
        {generating && <p className="mt-1 text-xs text-muted-foreground">カバー画像を生成中です…</p>}
      </div>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <CoverSettings {...settings} generating={generating} />
      </PanelSlotContent>
    </div>
  )
}
