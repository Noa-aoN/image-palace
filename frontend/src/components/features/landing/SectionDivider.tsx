import { cn } from '@/lib/utils'

interface SectionDividerProps {
  /** 雲型に塗る色（上端＝前セクション色 / flip時＝下端に垂らす色） */
  fill: string
  /** 上下反転（下端に向けて雲を垂らす。ヒーロー下端などで使用） */
  flip?: boolean
  className?: string
}

// 雲型区切り（控えめ・着脱容易）。既定はセクション上端に前セクション色を puffy に垂らす。
export function SectionDivider({ fill, flip, className }: SectionDividerProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={cn('section-divider', flip && 'section-divider--flip', className)}
    >
      <path
        d="M0,0 H1440 V20 C1320,45 1200,5 1040,28 C880,50 760,10 600,30 C460,48 320,12 160,32 C100,40 40,28 0,34 Z"
        fill={fill}
      />
    </svg>
  )
}
