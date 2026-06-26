import { cn } from '@/lib/utils'

interface SectionDividerProps {
  /** 前セクションの背景色（上端に雲のように垂らす） */
  fill: string
  className?: string
}

// セクション上端の雲型区切り（控えめ・着脱容易）。前セクションの色を puffy な下端で垂らす。
export function SectionDivider({ fill, className }: SectionDividerProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={cn('section-divider', className)}
    >
      <path
        d="M0,0 H1440 V20 C1320,45 1200,5 1040,28 C880,50 760,10 600,30 C460,48 320,12 160,32 C100,40 40,28 0,34 Z"
        fill={fill}
      />
    </svg>
  )
}
