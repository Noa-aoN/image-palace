'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pageview } from '@/lib/analytics'

/**
 * App Router のクライアント遷移ごとに page_view を送る。
 * 初回表示分は gtag('config') が自動送信するため、最初の発火はスキップして二重計上を防ぐ。
 * useSearchParams は Suspense 境界が必要なため内部コンポーネントに分離している。
 */
function PageViewInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const qs = searchParams.toString()
    pageview(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, searchParams])

  return null
}

export function AnalyticsPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewInner />
    </Suspense>
  )
}
