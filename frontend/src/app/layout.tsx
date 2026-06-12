import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AppHeader } from '@/components/features/layout/Header'
import { CookieConsentBanner } from '@/components/features/consent/CookieConsentBanner'
import { Analytics } from '@/components/features/consent/Analytics'
import { SentryInit } from '@/components/features/monitoring/SentryInit'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

// OG/Twitter 画像の絶対URL解決と og:url の基準にする
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://image-palace-frontend.image-palace.workers.dev'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ImagePalace',
    template: '%s | ImagePalace',
  },
  description: '単語をAI画像に変換して記憶できるサービス。',
  openGraph: {
    title: 'ImagePalace',
    description: '単語をAI画像に変換して記憶できるサービス。',
    url: SITE_URL,
    siteName: 'ImagePalace',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImagePalace',
    description: '単語をAI画像に変換して記憶できるサービス。',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: ブラウザ拡張（レスポンシブ確認ツール等）が
    // html/body に属性・クラス（例: mobile_mode）を注入することによる hydration mismatch を抑制
    <html lang="ja" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body
        className="h-full flex flex-col"
        style={{ backgroundColor: 'var(--ivory)' }}
        suppressHydrationWarning
      >
        <SentryInit />
        <AppHeader />
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
        <CookieConsentBanner />
        <Analytics />
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "4e38ecb6245142e79a3367465b6788e5"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
