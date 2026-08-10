'use client'

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { STATUS_LABEL } from '@/lib/item-status'
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/aspect-ratio'
import type { Item } from '@/types/item'

export const CARD_INFO_PANEL_KEY = 'item-card-info'

/**
 * カード自身の情報（作成日・状態・形など）。
 *
 * 学習に使う中身ではないので、本文に常時置かない。作成日が意味・説明と
 * 同じ面に並んでいると、覚えたいものと管理用の数字が混ざる。
 * 知りたいときだけ開く場所に移す。
 */
export function CardInfoButton({ item }: { item: Item }) {
  const panel = usePanelForm(CARD_INFO_PANEL_KEY, '情報')

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={panel.open}
        aria-expanded={panel.isOpen}
        className="flex items-center gap-1.5 text-sm"
      >
        <Info size={14} />
        情報
      </Button>

      <PanelSlotContent sectionKey={CARD_INFO_PANEL_KEY}>
        <dl className="space-y-3 text-sm">
          <Row label="作成日">{new Date(item.created_at).toLocaleString('ja-JP')}</Row>
          <Row label="状態">{STATUS_LABEL[item.generation_status]}</Row>
          <Row label="種別">{item.item_type?.label ?? '—'}</Row>
          <Row label="画像の形">{aspectLabel(item.aspect_ratio)}</Row>
          {item.image_model && <Row label="絵のモデル">{item.image_model}</Row>}
          <Row label="ID">
            <span className="break-all font-mono text-xs">{item.id}</span>
          </Row>
        </dl>
      </PanelSlotContent>
    </>
  )
}

// 対応表に無い値（古いデータ・未設定）でも落ちないようにする
function aspectLabel(key?: string): string {
  if (!key) return '—'
  return ASPECT_RATIOS[key as AspectRatioKey]?.label ?? key
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
