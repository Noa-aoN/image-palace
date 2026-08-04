'use client'

import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CoverSettings } from '@/components/features/shared/CoverSettings'
import { EntityCover } from '@/components/features/shared/EntityCover'
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

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
        <EntityCover cover={cover} fallback={fallback} />
      </div>
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
