import { cn } from '@/lib/utils'

interface SectionDividerProps {
  /** 波の上を塗る色（＝前セクションの地の色） */
  fill: string
  /** 上下反転（下端に向けて垂らす。ヒーロー下端などで使用） */
  flip?: boolean
  className?: string
}

/**
 * セクションの区切り。**波は1本だけ**。
 *
 * 以前は上辺も下辺も波にした二重の帯だった。上辺が波打つと、その谷間から
 * 次のセクションの地が覗いてしまい、区切りが「ちぎれた帯」に見えていた。
 * 区切りは前の面と次の面の**境目**なので、線は1本でよい。
 *
 * 波はサイン波の近似（半周期ごとに、制御点を 1/3・2/3 の位置へ振幅の 4/3 倍で置く）。
 * 適当な曲線を並べると、山谷の高さや幅が揃わず手描きのように見える。
 *
 * 上辺は直線で前セクションに密着させる。ここに隙間があると帯が宙に浮く。
 */
const BASE = 30 // 波の中心線（viewBox 0 0 1440 60）
const AMP = 18.7 // 制御点の振れ幅。実際の山は中心線から約14

const WAVE = [
  `M0,0 H1440 V${BASE}`,
  `C1320,${BASE + AMP} 1200,${BASE + AMP} 1080,${BASE}`,
  `C960,${BASE - AMP} 840,${BASE - AMP} 720,${BASE}`,
  `C600,${BASE + AMP} 480,${BASE + AMP} 360,${BASE}`,
  `C240,${BASE - AMP} 120,${BASE - AMP} 0,${BASE}`,
  'Z',
].join(' ')

export function SectionDivider({ fill, flip, className }: SectionDividerProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={cn('section-divider', flip && 'section-divider--flip', className)}
    >
      <path d={WAVE} fill={fill} />
    </svg>
  )
}
