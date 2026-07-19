'use client'

import type { ReactNode } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// 右パネルの汎用シェル（ヘッダ＋閉じる＋スクロール body）。
// 詳細・図形プロパティ・edge 編集など、中身を差し替えて再利用する。
export function PanelShell({
  title,
  onBack,
  backLabel,
  onClose,
  headerAction,
  children,
  className,
}: {
  title?: string
  onBack?: () => void
  backLabel?: string
  onClose: () => void
  headerAction?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel ? `${backLabel}へ戻る` : '戻る'}
            className="-ml-1.5 flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <ChevronLeft size={15} />
            {backLabel && <span className="whitespace-nowrap">{backLabel}</span>}
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          {headerAction}
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-md p-1 transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}
