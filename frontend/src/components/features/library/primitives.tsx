import type { ReactNode } from 'react'

// ライブラリ画面で共有する表示プリミティブ（横スクロールの棚・空の棚）。
export function Rail({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 overflow-x-auto pb-2">{children}</div>
}

export function EmptyRail({ message, cta }: { message: string; cta?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
      <span>{message}</span>
      {cta}
    </div>
  )
}
