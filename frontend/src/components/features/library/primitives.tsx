'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useShelfOrientation } from '@/components/features/display/ShelfBoard'

// ライブラリ画面で共有する表示プリミティブ（横スクロールの棚・空の棚）。
/**
 * 末尾の目印。視界に入ったら知らせる。
 *
 * 棚は先頭の数件しか取っていないので、そこまで送った人にだけ続きを取りに行く。
 * 監視するのはこの目印だけで、アイテム自体は監視しない（数が増えても負荷が変わらない）。
 */
function EndSentinel({ onReach }: { onReach: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReach()
      },
      // 端に着く手前で取り始め、待ち時間を体感させない
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [onReach])

  return <span ref={ref} aria-hidden className="block w-px shrink-0" />
}

export function Rail({ children, onEndReached }: { children: ReactNode; onEndReached?: () => void }) {
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
  return (
    <div data-rail className="flex gap-3.5 overflow-x-auto pb-3.5">
      {children}
      {onEndReached && <EndSentinel onReach={onEndReached} />}
    </div>
  )
}

export function EmptyRail({ message, cta }: { message: string; cta?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
      <span>{message}</span>
      {cta}
    </div>
  )
}
