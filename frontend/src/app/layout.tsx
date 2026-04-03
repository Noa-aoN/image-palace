import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AppHeader } from '@/components/features/layout/Header'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'ImagePalace',
    template: '%s | ImagePalace',
  },
  description: '単語をAI画像に変換して記憶できるサービス。',
  openGraph: {
    title: 'ImagePalace',
    description: '単語をAI画像に変換して記憶できるサービス。',
    url: 'https://image-palace-frontend.image-palace.workers.dev',
    siteName: 'ImagePalace',
    locale: 'ja_JP',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${geist.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: ブラウザ拡張が body 属性を追加することによる hydration mismatch を抑制 */}
      <body
        className="h-full flex flex-col"
        style={{ backgroundColor: 'var(--ivory)' }}
        suppressHydrationWarning
      >
        <AppHeader />
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </body>
    </html>
  )
}
