'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { PAGE_GAP, canGoTo, pageWindow } from '@/lib/pagination'

/**
 * ページ送り。
 *
 * **「前へ / 次へ」だけでは、遠くへ行けない。**
 * 40ページある一覧で最後を見たい人は、次へを39回押すことになる。
 *
 * 出すのは4種類。
 *   最初 ……… 端まで一手で戻る
 *   前へ ……… 1つずつ
 *   番号 ……… いまいる場所の周りと両端（間は「…」で省く）
 *   次へ・最後
 *
 * 番号の並びは `lib/pagination.ts` が決める。**どこにいても数を保つ**ので、
 * 送るたびに帯の幅が変わって押した先のボタンが動く、が起きない。
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
  className = '',
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  /** 読み込み中など、いま送らせたくないとき */
  disabled?: boolean
  className?: string
}) {
  // 1ページしかないなら出さない（押せないものを並べても場所を取るだけ）
  if (totalPages <= 1) return null

  const go = (target: number) => {
    if (disabled || !canGoTo(target, page, totalPages)) return
    onChange(target)
  }

  return (
    <nav className={`flex flex-wrap items-center justify-center gap-1 ${className}`} aria-label="ページ送り">
      <Step label="最初のページへ" onClick={() => go(1)} disabled={disabled || page <= 1}>
        <ChevronsLeft size={16} />
      </Step>
      <Step label="前のページへ" onClick={() => go(page - 1)} disabled={disabled || page <= 1}>
        <ChevronLeft size={16} />
      </Step>

      {pageWindow(page, totalPages).map((slot, index) =>
        slot === PAGE_GAP ? (
          // 省略は押せない。**印であって、行き先ではない**
          <span key={`gap-${index}`} aria-hidden className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={slot}
            type="button"
            onClick={() => go(slot)}
            disabled={disabled}
            aria-label={`${slot}ページ目へ`}
            aria-current={slot === page ? 'page' : undefined}
            className={`min-w-8 rounded-md px-2 py-1 text-sm tabular-nums transition-colors disabled:opacity-50 ${
              slot === page ? 'font-medium text-white' : 'text-muted-foreground hover:bg-muted'
            }`}
            style={slot === page ? { backgroundColor: 'var(--palace)' } : undefined}
          >
            {slot}
          </button>
        )
      )}

      <Step label="次のページへ" onClick={() => go(page + 1)} disabled={disabled || page >= totalPages}>
        <ChevronRight size={16} />
      </Step>
      <Step label="最後のページへ" onClick={() => go(totalPages)} disabled={disabled || page >= totalPages}>
        <ChevronsRight size={16} />
      </Step>
    </nav>
  )
}

/** 端・前後へ送る釦。印だけなので、読み上げ用の名前を必ず付ける */
function Step({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
