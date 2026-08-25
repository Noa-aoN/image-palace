'use client'

import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { safeguardImageClass, safeguardLook } from '@/lib/items/safeguard'

/**
 * 生成された絵に掛ける覆い。
 *
 * AI が作る絵は、思っていたものと違うことがある。学習中に不意打ちで見たくないものを
 * 見てしまわないよう、承認するまでは**なんとなく分かる程度**に抑えて出す。
 * 完全に隠すと「何が来たのか」が分からず、承認するか消すかを決められない。
 *
 * **隠すのはぼかしの役目。** 以前は黒い斜めの網を強く掛けていたが、
 * 網は絵の上に別の模様を足すだけで、絵そのものは網の隙間から素通しになる。
 * 「見えるところは見えてしまう」うえに、絵全体の色味は網に潰されて掴めない。
 *
 * 強くぼかせば、細部は読み取れないまま、色と構図の気配だけが残る。
 * 網は輪郭を拾わせないための薄い補助に留め、白い霞を重ねて直視の圧を下げる。
 *
 * 画像そのものは差し替えない（覆いを外せば元の絵が出る）。ぼかしは呼び出し側で
 * `SAFEGUARD_IMAGE_CLASS` を当てる。
 */
export function SafeguardVeil({ className }: { className?: string }) {
  // 濃さは設定から。**読めていないうちは標準**に倒す（覆いが外れてはいけない）
  const look = safeguardLook(useSettingsStore((s) => s.settings?.image_safeguard_strength))

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-10', className)}
      style={{
        // 白い霞。黒で沈めると何色の絵かも分からなくなるので、明るい側から薄く掛ける
        backgroundColor: `rgba(255,255,255,${look.wash})`,
        // 網はごく薄く、間隔も広く。**模様として読ませない**（気配を消さない程度）
        backgroundImage:
          `repeating-linear-gradient(45deg, rgba(0,0,0,${look.mesh}) 0 2px, rgba(0,0,0,0) 2px 14px)`,
      }}
    />
  )
}

/**
 * 覆っている絵に当てる class を、設定の濃さで引く。
 *
 * 呼び出し側が設定を読みに行かなくてよいように、ここで包む
 * （覆いと画像は対で1つの見え方なので、出どころを分けない）。
 */
export function useSafeguardImageClass(): string {
  return safeguardImageClass(useSettingsStore((s) => s.settings?.image_safeguard_strength))
}

/**
 * 覆いを掛けている間の画像の見た目。
 *
 * 強さは**細部が読めない／構図は掴める**の境目に置く。
 * 40px まで上げたときは、色の気配しか残らず「何の絵か」が分からなかった。
 * 24px なら、人物か風景か、どこに何があるかまでは伝わる。
 *
 * 拡大は縁のぼけを枠の外へ押し出すため（縮むと角に地が見える）。
 * 彩度を少し上げるのは、ぼかすと色が濁って見えるぶんの埋め合わせ
 */
/**
 * 標準の濃さの見た目。**設定を読めない場所（Server Component）のための控え。**
 * 画面から使うときは `useSafeguardImageClass()` を使うこと（設定が効く）。
 */
export const SAFEGUARD_IMAGE_CLASS = safeguardImageClass('normal')
