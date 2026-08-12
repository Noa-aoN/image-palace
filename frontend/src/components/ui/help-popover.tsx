'use client'

import type { ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { HelpCircle } from 'lucide-react'

/**
 * 「これは何か」を、押したときだけ開く。
 *
 * 指を乗せたら出る形（Tooltip）にしないのは、**触る画面に hover が無い**ため。
 * 携帯では、指を乗せるという操作そのものが存在しない。
 *
 * 説明が数行になるものも Tooltip では収まらない（あちらは一行の但し書き用で、
 * `whitespace-nowrap` が掛かっている）。読ませる文はこちらで開く。
 *
 * 釦は主操作より小さく、薄い色にする。ここは「困ったときに探すもの」であって、
 * 目に入り続けてよいものではない。
 */
export function HelpPopover({
  label,
  title,
  children,
}: {
  /** 何についての説明か。読み上げに使う（「パスキーについて」など） */
  label: string
  title?: string
  children: ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HelpCircle size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6}>
          {/* 携帯では画面幅に収める。widest でも読み切れる幅に留める */}
          <Popover.Popup className="z-50 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-sm shadow-lg outline-none">
            {title && <p className="mb-2 font-semibold">{title}</p>}
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
