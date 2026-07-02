import { cn } from '@/lib/utils'

// 汎用スケルトン・プリミティブ。読み込み中のプレースホルダに使う。
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />
}

// カード一覧の共通スケルトン（正方形グリッド）。
// withTitle=true でカード下のタイトルバー付き（アイテム一覧用）。
export function CardGridSkeleton({ count = 8, withTitle = false }: { count?: number; withTitle?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
