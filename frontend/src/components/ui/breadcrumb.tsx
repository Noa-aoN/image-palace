import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Crumb = {
  // リンク先。省略した要素はカレント（リンク無し）として扱う。
  href?: string
  label: string
}

// 各ページ左上の「← 戻る」を置き換える共通パンくず。
// 末尾要素をカレント（非リンク）、途中要素を親リンクとして描画する。
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="パンくずリスト" className={cn('mb-4', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate transition-colors hover:text-[var(--palace)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn('truncate', isLast && 'font-medium text-foreground')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight size={14} className="shrink-0 text-muted-foreground/60" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
