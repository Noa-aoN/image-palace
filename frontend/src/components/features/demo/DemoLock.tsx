'use client'

import { useAuthStore } from '@/stores/auth'
import { isDemoUser } from '@/lib/demo/session'
import { DEMO_LOCKED_HINT } from '@/lib/demo/navigation'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * いま体験中かどうか。
 *
 * **購読する。** `getState()` で読むと、入り直しても灰色のままになる。
 */
export function useIsDemo(): boolean {
  const user = useAuthStore((state) => state.user)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)

  return hasHydrated && isDemoUser(user)
}

/**
 * 体験中に使えないものを、**隠さずに灰色にして押せなくする。**
 *
 * 消してしまうと「この宮殿にはそれが無い」と読まれる。
 * 体験は本物がどういうものかを見てもらう場なので、
 * あることは見せて、いまは使えないことだけを伝える。
 *
 * `pointer-events-none` で中身ごと押せなくするが、**外側では拾う**。
 * そうしないと、なぜ押せないのかを出す手立てが無くなる
 * （中が全部無反応だと、ホバーも起きない）。
 *
 * 理由は `title` ではなく `Tooltip` で出す。標準の `title` は出るまで約1秒かかり、
 * **迷って手が止まってから**ようやく出るので間に合わない。
 */
export function DemoLock({
  children,
  when,
  className = '',
}: {
  children: React.ReactNode
  /** 体験中でも、ここが false なら閉じない（名前だけ見せたいときなど） */
  when?: boolean
  className?: string
}) {
  const isDemo = useIsDemo()
  const locked = isDemo && when !== false

  if (!locked) return <>{children}</>

  return (
    <Tooltip label={DEMO_LOCKED_HINT}>
      <span aria-disabled className={`inline-flex cursor-not-allowed opacity-40 ${className}`}>
        <span className="pointer-events-none contents">{children}</span>
      </span>
    </Tooltip>
  )
}

/**
 * 面（カード・節）ごと閉じるとき。
 *
 * `DemoLock` は横並びの中に置く前提で `inline-flex` にしてあるので、
 * 面には使えない（幅が中身なりに縮む）。こちらは流れの中で場所を保つ。
 */
export function DemoLockBlock({
  children,
  when,
  className = '',
}: {
  children: React.ReactNode
  when?: boolean
  className?: string
}) {
  const isDemo = useIsDemo()
  const locked = isDemo && when !== false

  if (!locked) return <>{children}</>

  return (
    <Tooltip label={DEMO_LOCKED_HINT}>
      <div aria-disabled className={`cursor-not-allowed opacity-40 ${className}`}>
        <div className="pointer-events-none">{children}</div>
      </div>
    </Tooltip>
  )
}
