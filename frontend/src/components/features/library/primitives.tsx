'use client'

import type { ReactNode } from 'react'
import { useShelfOrientation } from '@/components/features/display/ShelfBoard'

// ライブラリ画面で共有する表示プリミティブ（横スクロールの棚・空の棚）。
export function Rail({ children }: { children: ReactNode }) {
  // 縦棚（横並び）のときは列幅が狭いので、横スクロールではなく上から積む
  const orientation = useShelfOrientation()
  if (orientation === 'columns') {
    // 縦棚ではスクロールを出さない。アイテムは固定幅ではなく列いっぱいに広げ、
    // 横にはみ出させない（タイル側の w-40 を上書きする）。高さも中身なりに伸ばす。
    return (
      <div data-rail className="flex flex-col gap-3 pb-2 [&>*]:!w-full [&>*]:shrink">
        {children}
      </div>
    )
  }
  return <div data-rail className="flex gap-3.5 overflow-x-auto pb-3.5 pr-10">{children}</div>
}

export function EmptyRail({ message, cta }: { message: string; cta?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
      <span>{message}</span>
      {cta}
    </div>
  )
}
