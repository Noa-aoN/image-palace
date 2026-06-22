'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { useConsentStore } from '@/stores/consent'
import { GA_ID } from '@/lib/analytics'

/**
 * Google Analytics タグ（Google Consent Mode v2）。
 *
 * gtag.js は同意状態に関わらず読み込む（Google のタグ検出を通すため）。
 * ただし同意前は consent default を `denied` にしておき、Cookie を置かず
 * 計測データを送らない（Cookieレスの同意シグナルのみ）。ユーザーが同意したら
 * `granted` に update して通常計測を開始する。
 *
 * NEXT_PUBLIC_GA_ID が無い環境では何もレンダリングしない。
 */
export function Analytics() {
  const consent = useConsentStore((s) => s.consent)
  const hasHydrated = useConsentStore((s) => s.hasHydrated)

  // セッション中の同意トグル（バナー/設定ページ）を gtag に反映する。
  // 初期状態は下のインライン consent default が担うため、ここは変更時の update のみ。
  useEffect(() => {
    if (!GA_ID || !hasHydrated) return
    if (typeof window.gtag !== 'function') return
    window.gtag('consent', 'update', {
      analytics_storage: consent === 'accepted' ? 'granted' : 'denied',
    })
  }, [consent, hasHydrated])

  // hasHydrated を待つことで、保存済みの同意を初回 dataLayer に反映できる
  // （再訪問の同意済みユーザーは最初から granted で開始でき、update とのレースが無い）。
  if (!GA_ID || !hasHydrated) return null

  const analyticsConsent = consent === 'accepted' ? 'granted' : 'denied'

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
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: '${analyticsConsent}',
            wait_for_update: 500
          });
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
