import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Brain, Layers, Search, GalleryVerticalEnd } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingFooter } from '@/components/features/layout/LandingFooter'
import { HeroScrollZoom } from '@/components/features/landing/HeroScrollZoom'

export const metadata: Metadata = {
  title: { absolute: 'ImagePalace — 単語をイメージに変換して記憶できるサービス' },
}

const FEATURES = [
  { icon: <Brain size={20} />, title: 'イメージで記憶', body: '無機質な単語を視覚的な手がかりに変え、思い出しやすくします。' },
  { icon: <Layers size={20} />, title: '自由に整理', body: 'ビュー・コレクション・スペースで、知識を自分の構造にまとめられます。' },
  { icon: <Search size={20} />, title: 'すぐ探せる', body: 'タグと検索で、必要なカードをすぐに引き出せます。' },
]

// HA（ヒーロー）と同じく全画面サイズのセクション。内容は仮埋め。
// data-anim-layer は今後アニメーションを重ねるための空レイヤー。
function Section({ bg, children }: { bg?: string; children: ReactNode }) {
  return (
    <section
      className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
      style={bg ? { backgroundColor: bg } : undefined}
    >
      <div aria-hidden data-anim-layer className="pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto w-full max-w-4xl">{children}</div>
    </section>
  )
}

export default function TopPage() {
  return (
    <div className="flex flex-col flex-1">
      {/* HA: ヒーロー（スクロール連動ズーム） */}
      <HeroScrollZoom />

      {/* 1. コンセプト（仮） */}
      <Section bg="var(--ivory)">
        <p className="mb-4 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>CONCEPT</p>
        <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>
          記憶を、設計する。
        </h2>
        <p className="mx-auto max-w-xl text-base leading-relaxed md:text-lg" style={{ color: '#4A4A4A' }}>
          テキスト中心の学習に違和感を持つ人へ。単語や概念をAIでイメージに変換し、
          視覚的に保持・想起できる「自分だけの記憶の宮殿」を育てます。
        </p>
        <p className="mt-6 text-xs text-muted-foreground">※ 内容は仮。ここにコンセプトの演出を追加予定。</p>
      </Section>

      {/* 2. 機能（仮） */}
      <Section bg="var(--ivory-dark)">
        <p className="mb-4 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>FEATURES</p>
        <h2 className="mb-12 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>できること</h2>
        <div className="grid gap-6 text-left md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-card px-6 py-8" style={{ border: '1px solid var(--palace)' }}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}>
                {f.icon}
              </div>
              <h3 className="mb-2 font-semibold" style={{ color: '#111111' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. 作例（仮） */}
      <Section bg="#ffffff">
        <p className="mb-4 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>GALLERY</p>
        <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>作例</h2>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: '#4A4A4A' }}>
          生成したカードの作例をここに並べます。（準備中）
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted/40">
              <GalleryVerticalEnd size={28} className="text-muted-foreground/40" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">※ 内容は仮。作例の演出を追加予定。</p>
      </Section>

      {/* 4. 再度の入り口（仮） */}
      <Section bg="var(--ivory)">
        <h2 className="mb-8 text-2xl font-bold md:text-3xl" style={{ color: '#111111' }}>
          今日から、記憶を育てはじめましょう。
        </h2>
        <div className="flex w-full max-w-sm flex-col items-center gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:justify-center">
          <Link href="/signup" className="w-full sm:w-44">
            <Button size="lg" className="w-full px-8 text-base sm:w-44" style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}>
              無料ではじめる
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-44">
            <Button size="lg" variant="outline" className="w-full px-8 text-base sm:w-44">
              ログイン
            </Button>
          </Link>
        </div>
      </Section>

      <LandingFooter />
    </div>
  )
}
