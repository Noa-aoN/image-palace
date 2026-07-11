'use client'

import type { GenerationStatus } from '@/types/item'
import { STATUS_LABEL, STATUS_COLOR, STATUS_ICON } from '@/lib/item-status'
import { useUiStore } from '@/stores/ui'

/**
 * カードの生成ステータスバッジ。アイコン＋ラベルのピルで表示する。
 * - 完了（completed）は画像で伝わるため常に非表示。
 * - 環境設定のトグル（showStatusBadges）が OFF なら生成中・失敗も含めて非表示。
 */
export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: GenerationStatus
  size?: 'sm' | 'lg'
}) {
  const show = useUiStore((s) => s.showStatusBadges)
  if (!show || status === 'completed') return null

  const Icon = STATUS_ICON[status]
  const sizing = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  const iconSize = size === 'lg' ? 14 : 12

  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full font-medium ${sizing} ${STATUS_COLOR[status] ?? ''}`}
    >
      {Icon && (
        <Icon size={iconSize} className={status === 'processing' ? 'animate-spin' : undefined} />
      )}
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
