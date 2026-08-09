import { cn } from '@/lib/utils'
import { cardGridClass } from '@/lib/card-grid'

// 汎用スケルトン・プリミティブ。読み込み中のプレースホルダに使う。
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/**
 * カード一覧の共通スケルトン。
 *
 * columns / count は**呼び出し側の表示設定から渡す**。既定の 5列8枚に固定していると、
 * 10列25枚に設定している人は「5列8枚 → 10列25枚」と一度組み替わる画面を見ることになる。
 * 読み込み中と読み込み後で格子が変わらないことが、この部品の役目。
 *
 * withTitle=true でカード下のタイトルバー付き（カード一覧用）。
 */
export function CardGridSkeleton({
  count = 8,
  withTitle = false,
  columns,
}: {
  count?: number
  withTitle?: boolean
  /** 表示設定の列数。省略時は既定の格子 */
  columns?: number
}) {
  return (
    <div className={cn('grid gap-4', cardGridClass(columns))}>
      {Array.from({ length: count }).map((_, i) =>
        withTitle ? (
          <div key={i} className="overflow-hidden rounded-xl border border-border">
            <div className="aspect-square w-full animate-pulse bg-muted" />
            <div className="px-3 py-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : (
          <div key={i} className="aspect-square animate-pulse rounded-xl border border-border bg-muted" />
        )
      )}
    </div>
  )
}
