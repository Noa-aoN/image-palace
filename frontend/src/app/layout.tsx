import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AppHeader } from '@/components/features/layout/Header'
import { CookieConsentBanner } from '@/components/features/consent/CookieConsentBanner'
import { Analytics } from '@/components/features/consent/Analytics'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // OG/Twitter 画像の絶対URL解決と og:url の基準にする
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
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
        <AppHeader />
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
        <CookieConsentBanner />
        <Analytics />
        {/* Cloudflare Web Analytics ビーコンは本番ビルドのみ。
            開発(localhost)では cloudflareinsights への送信が CORS で失敗しコンソールを汚すため読み込まない。 */}
        {process.env.NODE_ENV === 'production' && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "4e38ecb6245142e79a3367465b6788e5"}'
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
