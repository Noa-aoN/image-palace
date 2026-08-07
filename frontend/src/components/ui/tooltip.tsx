'use client'

import type { ReactNode } from 'react'

/**
 * アイコンだけのボタンに、何をするものかを添える。
 *
 * アイコンは場所を取らない代わりに、意味が読み手の推測任せになる。
 * ブラウザ標準の title 属性は出るまで約1秒かかり、迷って手が止まってから
 * ようやく出るので間に合わない。指を乗せた時点で出す。
 *
 * キーボードで辿ったときにも出す（focus-within）。マウスを持たない人にも
 * 同じ情報が要る。
 *
 * 名前付きの group を使うのは、カードの画像枠など既に group を張っている
 * 入れ子の中でも誤って反応しないようにするため。
 */
export function Tooltip({
  label,
  children,
  side = 'bottom',
}: {
  label: string
  children: ReactNode
  /** 上に出すか下に出すか。行の一番上にあるものは下、下端にあるものは上 */
  side?: 'top' | 'bottom'
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs leading-snug text-background opacity-0 shadow-md transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
      >
        {label}
      </span>
    </span>
  )
}
