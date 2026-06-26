import type { Metadata } from 'next'
import Link from 'next/link'
import { PenLine, Sparkles, GalleryVerticalEnd, Layers, Search, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingFooter } from '@/components/features/layout/LandingFooter'
import { HeroScrollZoom } from '@/components/features/landing/HeroScrollZoom'

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

      {/* Hero（スクロール連動ズーム） */}
      <HeroScrollZoom />

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
