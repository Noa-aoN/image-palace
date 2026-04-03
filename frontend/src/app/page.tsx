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

      {/* Features */}
      <section className="px-6 py-16 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <p className="text-2xl font-bold" style={{ color: 'var(--palace)' }}>生成</p>
            <p className="text-sm" style={{ color: '#4A4A4A' }}>
              単語を入力するだけで AI が画像を自動生成。視覚的な記憶の手がかりをつくります。
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold" style={{ color: 'var(--palace)' }}>管理</p>
            <p className="text-sm" style={{ color: '#4A4A4A' }}>
              生成したカードはグリッド形式で一覧表示。いつでも見返して記憶を定着させます。
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold" style={{ color: 'var(--palace)' }}>想起</p>
            <p className="text-sm" style={{ color: '#4A4A4A' }}>
              必要なときに、必要な知識を思い出せる。あなただけの記憶の宮殿を育てましょう。
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
