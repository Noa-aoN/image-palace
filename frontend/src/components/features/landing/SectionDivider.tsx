import { cn } from '@/lib/utils'

interface SectionDividerProps {
  /** 雲型に塗る色（上端＝前セクション色 / flip時＝下端に垂らす色） */
  fill: string
  /** 上下反転（下端に向けて雲を垂らす。ヒーロー下端などで使用） */
  flip?: boolean
  className?: string
}

// 雲型区切り（控えめ・着脱容易）。既定はセクション上端に前セクション色を puffy に垂らす。
//
// 上下とも波にして「波線2重」にしている。上辺を直線にすると境目が定規で引いた線になり、
// 下側の波だけが浮いて見えるため。上の波は所々で y=0 に接し、前セクションと地続きに保つ
// （接点が無いと帯が宙に浮いて、隙間のように見える）。下の波は従来のまま。
const WAVE_TOP = 'M0,0 C160,1 260,20 420,16 C580,12 660,1 820,3 C1000,5 1080,22 1240,18 C1340,16 1400,3 1440,0'
const WAVE_BOTTOM = 'V20 C1320,45 1200,5 1040,28 C880,50 760,10 600,30 C460,48 320,12 160,32 C100,40 40,28 0,34 Z'

export function SectionDivider({ fill, flip, className }: SectionDividerProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={cn('section-divider', flip && 'section-divider--flip', className)}
    >
      <path d={`${WAVE_TOP} ${WAVE_BOTTOM}`} fill={fill} />
    </svg>
  )
}
