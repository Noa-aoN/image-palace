import { cn } from '@/lib/utils'

interface SectionDividerProps {
  /** 波の上を塗る色（＝前セクションの地の色） */
  fill: string
  /** 上下反転（下端に向けて垂らす。ヒーロー下端などで使用） */
  flip?: boolean
  className?: string
}

/**
 * セクションの区切り。**同じ形の波を2本、平行に並べる**。
 *
 * 上が直線・下が波では、直線のほうが目につく（人は直線を先に拾う）。
 * 「直線で区切ったあとに波が飾ってある」ように見えてしまう。
 *
 * かといって、上下で違う形の波を引くと帯の厚みが場所ごとに変わり、
 * ちぎれた紙のように見える。**同じ波を縦にずらす**と厚みが一定になり、
 * 2本が平行な線として読める。
 *
 * 塗りは2段。上段は前セクションの色そのまま、下段はその半分の濃さ。
 * 濃さが変わる位置＝波の位置なので、線を引かなくても波が2本見える。
 * （線として描くと、拡大縮小で太さが変わる・端で途切れるなどの面倒が増える）
 *
 * 波はサイン波の近似（半周期ごとに、制御点を 1/3・2/3 の位置へ振幅の 4/3 倍で置く）。
 * 適当な曲線を並べると、山谷の高さや幅が揃わず手描きのように見える。
 *
 * **上端はぼかさない。** ぼかすと次セクションの地が透けて、境界に直線が1本出る
 * （地の色が節ごとに違うため）。前セクションの色でぴったり塞ぐ。
 * 道が塞ぎに当たって直線で切れる件は、道側を境目の前後で霞ませて解いている。
 */
const UPPER = 34 // 上の波の中心線（viewBox 0 0 1440 120）。塗る面積を抑えるため上へ寄せる
const LOWER = 66 // 下の波の中心線。UPPER との差が帯の厚み
const AMP = 18.7 // 制御点の振れ幅。実際の山は中心線から約14

/** 左→右へ波を描く（先頭に (0,base) がある前提） */
const waveLTR = (b: number) =>
  [
    `C120,${b - AMP} 240,${b - AMP} 360,${b}`,
    `C480,${b + AMP} 600,${b + AMP} 720,${b}`,
    `C840,${b - AMP} 960,${b - AMP} 1080,${b}`,
    `C1200,${b + AMP} 1320,${b + AMP} 1440,${b}`,
  ].join(' ')

/** 右→左へ、同じ波をたどる（塗りを閉じる側） */
const waveRTL = (b: number) =>
  [
    `C1320,${b + AMP} 1200,${b + AMP} 1080,${b}`,
    `C960,${b - AMP} 840,${b - AMP} 720,${b}`,
    `C600,${b + AMP} 480,${b + AMP} 360,${b}`,
    `C240,${b - AMP} 120,${b - AMP} 0,${b}`,
  ].join(' ')

/** 最上部から上の波まで（前セクションの色そのまま） */
const BAND_UPPER = `M0,0 H1440 V${UPPER} ${waveRTL(UPPER)} Z`

/** 上の波から下の波まで（中間の濃さ）。**同じ波を 32 下へずらすだけ** */
const BAND_LOWER = `M0,${UPPER} ${waveLTR(UPPER)} V${LOWER} ${waveRTL(LOWER)} Z`

export function SectionDivider({ fill, flip, className }: SectionDividerProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={cn('section-divider', flip && 'section-divider--flip', className)}
    >
      <path d={BAND_UPPER} fill={fill} />
      <path d={BAND_LOWER} fill={fill} opacity={0.5} />
    </svg>
  )
}
