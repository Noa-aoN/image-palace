'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from './Sidebar'

/**
 * ログインしている人にだけ、いつもの脇の並びを出す。
 *
 * 公開のページ（使い方・読みもの）は、検索や共有から**初めての人**が直に開く。
 * そこにアプリの脇の並びを出しても、押した先はログインへ送られるだけで、
 * 読みに来た人の邪魔になる。
 *
 * ログインの有無は端末の中にしか無いので、**サーバー側では何も出さない**。
 * 出してから消すと、初めての人に一瞬だけ見せることになる。
 */
export function SignedInSidebar() {
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

  if (!ready || !isAuthenticated) return null

  return <Sidebar />
}
