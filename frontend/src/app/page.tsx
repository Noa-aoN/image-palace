import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LandingFooter } from '@/components/features/layout/LandingFooter'

export const metadata: Metadata = {
  title: { absolute: 'ImagePalace — 単語をイメージに変換して記憶できるサービス' },
}

export default function TopPage() {
  return (
    <div className="flex flex-col flex-1">

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 py-18 md:py-22 text-center">
        <p className="text-sm tracking-widest mb-4 font-medium" style={{ color: 'var(--palace)' }}>
          IMAGE PALACE
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ color: '#111111' }}>
          単語をイメージに変えて、
          <br />
          記憶を設計する。
        </h1>
        <p className="text-base md:text-lg max-w-md mb-10" style={{ color: '#4A4A4A' }}>
          AIが単語を画像カードに変換。
          自分だけの記憶の宮殿を、少しずつ育てていけます。
        </p>
        <div className="flex w-full max-w-sm flex-col sm:w-auto sm:max-w-none sm:flex-row gap-3">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full px-8 text-base sm:w-auto"
              style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
            >
              無料ではじめる
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full px-8 text-base sm:w-auto">
              ログイン
            </Button>
          </Link>
        </div>
      </section>

      <LandingFooter />

    </div>
  )
}
