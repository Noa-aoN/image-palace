'use client'

import { useSearchParams } from 'next/navigation'

/**
 * 体験の宮殿から来た人へ、先に伝えておくこと。
 *
 * **体験で並べ替えたり整えたりしたものは、引き継がれない。**
 * 引き継ぐ仕組みが無いのではなく、引き継ぐものが実質無い。
 * 体験では絵を作れないので、増えているのは並びだけ。
 *
 * だが「消える」とだけ言うと損した気持ちだけが残る。
 * **同じ中身は登録後に受け取れる**ことを、同じ場所で言う。
 *
 * 登録の画面に着いた時点で言う。作り終えてから知らせるのでは遅い。
 */
export function FromDemoNote() {
  const params = useSearchParams()

  if (params.get('from') !== 'demo') return null

  return (
    <div
      className="mb-6 rounded-xl border px-4 py-3 text-sm leading-relaxed"
      style={{
        borderColor: 'var(--palace)',
        backgroundColor: 'color-mix(in srgb, var(--palace) 8%, transparent)',
      }}
    >
      <p className="font-medium">体験の宮殿はいかがでしたか。</p>
      <p className="mt-1 text-muted-foreground">
        体験でご覧になった宮殿は、ここで作る宮殿とは別のものです。
        <strong className="text-foreground">並べ替えなどは引き継がれません</strong>が、
        <strong className="text-foreground">同じ中身は、登録のあとすぐ受け取れます</strong>。
      </p>
    </div>
  )
}
