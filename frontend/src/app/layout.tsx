import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AppHeader } from '@/components/features/layout/Header'
import { SettingsBootstrap } from '@/components/features/layout/SettingsBootstrap'
import { CookieConsentBanner } from '@/components/features/consent/CookieConsentBanner'
import { SaveStatusNotice } from '@/components/features/shared/SaveStatusNotice'
import { Analytics } from '@/components/features/consent/Analytics'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'
import { THEME_COLOR } from '@/lib/pwa/manifest'

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
  // ブラウザが「このアプリの名前」として使う（インストール時の既定名など）
  applicationName: SITE_NAME,
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
  // 検索結果に大きな絵を出させる。付けないと縮小版になり、OGP の絵が活きない。
  // クロールさせない画面は robots.txt 側（PRIVATE_PATHS）で止めている
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  // 端末に入れて使えるようにする。iOS はここを見て、上の帯と起動の見た目を決める
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
  // iOS が本文中の数字を勝手に電話番号のリンクにするのを止める
  // （クレジット残高や日付が青くなって押せてしまう）
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: 'light',
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
        <SettingsBootstrap />
        <AppHeader />
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
        {/* 保存が落ちたことを伝える札。**ここに置く。**
            (app) の中は `isolate` で重なりの世界が閉じており、
            そこへ置くと Cookie の札より後ろに回って読めなくなる（実測） */}
        <SaveStatusNotice />
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
