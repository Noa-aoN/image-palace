'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useHeroZoom } from '@/hooks/useHeroZoom'

// LP ヒーロー：スクロールで画像中央のドアへズームし、終盤に次セクションへブレンドする。
// 構造: track(縦長) → stage(sticky, 100svh) → 画像/ぼかし/スクリム/ブレンド + テキスト。
export function HeroScrollZoom() {
  const { trackRef, stageRef, reduced } = useHeroZoom()

  return (
    <section ref={trackRef} className="hero-track" data-reduced={reduced ? 'true' : 'false'}>
      <div
        ref={stageRef}
        className="hero-stage flex flex-col items-center justify-start px-6 pt-24 text-center md:pt-28"
      >
        {/* 背景画像（ズーム対象・最背面） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-palace.jpg" alt="" aria-hidden fetchPriority="high" decoding="async" className="hero-zoom" />
        {/* 下部のぼかし */}
        <div aria-hidden className="hero-blur" />
        {/* アイボリースクリム（可読性） */}
        <div aria-hidden className="hero-scrim" />
        {/* 次セクションへのブレンド（ズーム終盤でフェードイン） */}
        <div aria-hidden className="hero-blend" />

        {/* テキスト/CTA（最前面・ズームでフェードアウト） */}
        <div className="hero-content flex flex-col items-center">
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
        </div>
      </div>
    </section>
  )
}
