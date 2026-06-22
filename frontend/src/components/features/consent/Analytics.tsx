'use client'

import Script from 'next/script'
import { useConsentStore } from '@/stores/consent'
import { GA_ID } from '@/lib/analytics'

/**
 * Google Analytics タグ。ユーザーが Cookie 同意した場合のみ読み込む。
 * NEXT_PUBLIC_GA_ID が無い環境では何もレンダリングしない。
 */
export function Analytics() {
  const consent = useConsentStore((s) => s.consent)
  const hasHydrated = useConsentStore((s) => s.hasHydrated)

  if (!GA_ID) return null
  if (!hasHydrated || consent !== 'accepted') return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
