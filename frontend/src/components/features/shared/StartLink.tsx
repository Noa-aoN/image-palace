'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { startHref } from '@/lib/auth/start-href'

/**
 * 公開のページから、アプリの中へ進むための行き先。
 *
 * まだログインしていない人を作成画面へ送っても、門で止められて `/login` に飛ぶ。
 * **読みに来た人が、押した先で追い返される**形になる。
 * そうならないよう、ログインしていなければ登録へ送る。
 *
 * ログインの有無は端末の中にしか無いので、サーバー側では登録側を出しておく
 * （初めての人のほうが多いページで、書き換わる回数が少ないほうを既定にする）。
 */
export function StartLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mark = () => setReady(true)

    if (useAuthStore.persist.hasHydrated()) {
      const id = setTimeout(mark, 0)
      return () => clearTimeout(id)
    }

    return useAuthStore.persist.onFinishHydration(mark)
  }, [])

  return (
    <Link href={startHref(href, { ready, isAuthenticated })} className={className}>
      {children}
    </Link>
  )
}
