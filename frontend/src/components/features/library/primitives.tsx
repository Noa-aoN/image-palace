'use client'

import type { ReactNode } from 'react'
import { useShelfOrientation } from '@/components/features/display/ShelfBoard'

// ライブラリ画面で共有する表示プリミティブ（横スクロールの棚・空の棚）。
export function Rail({ children }: { children: ReactNode }) {
  // 縦棚（横並び）のときは列幅が狭いので、横スクロールではなく上から積む
  const orientation = useShelfOrientation()
  if (orientation === 'columns') {
    // 棚 1 本が伸び続けるとページ全体が間延びするため、適度な高さで区切って中をスクロールさせる。
    // 高さを揃えることで、横に並べたときの棚の背丈も揃う。
    return (
      <div
        data-rail
        className="flex max-h-[22rem] flex-col gap-3 overflow-y-auto pb-2 pr-1 sm:max-h-[26rem]"
      >
        {children}
      </div>
    )
  }
  return <div data-rail className="flex gap-3 overflow-x-auto pb-3.5">{children}</div>
}

export function EmptyRail({ message, cta }: { message: string; cta?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
      <span>{message}</span>
      {cta}
    </div>
  )
}
