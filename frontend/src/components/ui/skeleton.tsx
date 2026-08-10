import { cn } from '@/lib/utils'
import { cardGridClass } from '@/lib/card-grid'

// 汎用スケルトン・プリミティブ。読み込み中のプレースホルダに使う。
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/**
 * カード一覧の共通スケルトン。
 *
 * columns / count / aspectRatio は**呼び出し側の実際の見た目から渡す**。
 * 既定に固定していると、読み込みが終わった瞬間に格子が組み替わって画面が飛ぶ。
 * 読み込み中と読み込み後で形が変わらないことが、この部品の役目。
 *
 * withTitle=true でカード下のタイトルバー付き（カード一覧用）。
 */
export function CardGridSkeleton({
  count = 8,
  withTitle = false,
  columns,
  aspectRatio = '1 / 1',
}: {
  count?: number
  withTitle?: boolean
  /** 表示設定の列数。省略時は既定の格子 */
  columns?: number
  /** 1枚の縦横比。並ぶカードの形に合わせる（CSS の aspect-ratio） */
  aspectRatio?: string
}) {
  return (
    <div className={cn('grid gap-4', cardGridClass(columns))}>
      {Array.from({ length: count }).map((_, i) =>
        withTitle ? (
          <div key={i} className="overflow-hidden rounded-xl border border-border">
            <div className="w-full animate-pulse bg-muted" style={{ aspectRatio }} />
            <div className="px-3 py-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-muted"
            style={{ aspectRatio }}
          />
        )
      )}
    </div>
  )
}
