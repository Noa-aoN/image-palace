import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: { absolute: 'ImagePalace — 単語をイメージに変換して記憶できるサービス' },
}

export default function TopPage() {
  return (
    <div className="flex flex-col flex-1">

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 py-24 text-center">
        <p className="text-sm tracking-widest mb-4 font-medium" style={{ color: 'var(--palace)' }}>
          IMAGE PALACE
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ color: '#111111' }}>
          単語をイメージに変えて、
          <br />
          記憶を設計する。
        </h1>
        <p className="text-base md:text-lg max-w-md mb-10" style={{ color: '#4A4A4A' }}>
          AI が単語を画像に変換し、視覚的に記憶しやすいカード形式で管理・想起できます。
          テキストより画像で覚えたい人のための、記憶設計ツールです。
        </p>
        <div className="flex gap-3">
          <Link href="/signup">
            <Button
              size="lg"
              className="px-8 text-base"
              style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
            >
              無料ではじめる
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="px-8 text-base">
              ログイン
            </Button>
          </Link>
        </div>
      </section>

    </div>
  )
}
