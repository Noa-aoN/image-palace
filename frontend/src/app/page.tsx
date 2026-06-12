import type { Metadata } from 'next'
import Link from 'next/link'
import { PenLine, Sparkles, GalleryVerticalEnd, Layers, Search, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingFooter } from '@/components/features/layout/LandingFooter'

export const metadata: Metadata = {
  title: { absolute: 'ImagePalace — 単語をイメージに変換して記憶できるサービス' },
}

const STEPS = [
  {
    icon: <PenLine size={26} />,
    title: '単語を入力',
    body: '覚えたい単語や概念を入力します。改行・カンマ区切りでまとめて追加できます。',
  },
  {
    icon: <Sparkles size={26} />,
    title: 'AIが画像化',
    body: 'AIが単語をイメージ画像に変換し、カードとして保存します。',
  },
  {
    icon: <GalleryVerticalEnd size={26} />,
    title: 'カードで見返す',
    body: '画像付きカードで見返し、デッキやコレクションに整理して記憶を育てます。',
  },
]

const FEATURES = [
  { icon: <Brain size={20} />, title: 'イメージで記憶', body: '無機質な単語を視覚的な手がかりに変え、思い出しやすくします。' },
  { icon: <Layers size={20} />, title: '自由に整理', body: 'デッキ・コレクション・スペースで、知識を自分の構造にまとめられます。' },
  { icon: <Search size={20} />, title: 'すぐ探せる', body: 'タグと検索で、必要なカードをすぐに引き出せます。' },
]

export default function TopPage() {
  return (
    <div className="flex flex-col flex-1">

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-20 md:py-28 text-center">
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

      {/* 使い方 */}
      <section className="px-6 py-16" style={{ backgroundColor: 'var(--ivory-dark)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3" style={{ color: '#111111' }}>使い方は3ステップ</h2>
          <p className="text-center text-sm md:text-base mb-12" style={{ color: '#4A4A4A' }}>
            入力するだけで、画像付きの記憶カードができあがります。
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl bg-card px-6 py-8 text-center" style={{ border: '1px solid var(--palace)' }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}>
                  {step.icon}
                </div>
                <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--palace)' }}>STEP {i + 1}</p>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#111111' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 特長 */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12" style={{ color: '#111111' }}>ImagePalace でできること</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--palace)' }}>{f.icon}</span>
                  <h3 className="font-semibold" style={{ color: '#111111' }}>{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 末尾CTA */}
      <section className="px-6 pb-20 pt-4 text-center">
        <h2 className="text-xl md:text-2xl font-bold mb-6" style={{ color: '#111111' }}>
          今日から、記憶を育てはじめましょう。
        </h2>
        <Link href="/signup">
          <Button size="lg" className="px-10 text-base" style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}>
            無料ではじめる
          </Button>
        </Link>
      </section>

      <LandingFooter />

    </div>
  )
}
