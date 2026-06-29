import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'palace' | 'muted'

// 小さなピル型ラベル。palace=ゴールド系の強調、muted=控えめ。
export function Badge({
  children,
  variant = 'muted',
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'muted' && 'bg-muted text-muted-foreground',
        className
      )}
      style={variant === 'palace' ? { backgroundColor: 'rgba(198,167,94,0.12)', color: 'var(--palace)' } : undefined}
    >
      {children}
    </span>
  )
}
