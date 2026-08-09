import { cn } from '@/lib/utils'

/**
 * 生成された絵に掛ける覆い。
 *
 * AI が作る絵は、思っていたものと違うことがある。学習中に不意打ちで見たくないものを
 * 見てしまわないよう、承認するまでは**なんとなく分かる程度**に抑えて出す。
 * 完全に隠すと「何が来たのか」が分からず、承認するか消すかを決められないため、
 * ぼかしの上に斜めの網を掛けて、輪郭と色味だけが伝わる強さにしている。
 *
 * 画像そのものは差し替えない（覆いを外せば元の絵が出る）。ぼかしは呼び出し側で
 * `SAFEGUARD_IMAGE_CLASS` を当てる。
 */
export function SafeguardVeil({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-10', className)}
      style={{
        // 斜めの網。線を細く・間隔を広くして、下の絵の形は残す
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(0,0,0,0.30) 0 3px, rgba(0,0,0,0) 3px 9px)',
        backgroundColor: 'rgba(0,0,0,0.14)',
      }}
    />
  )
}

/** 覆いを掛けている間の画像の見た目。輪郭と色味だけが残る強さ */
export const SAFEGUARD_IMAGE_CLASS = 'blur-md scale-105'
