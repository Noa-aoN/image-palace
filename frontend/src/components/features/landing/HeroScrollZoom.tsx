'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useHeroZoom } from '@/hooks/useHeroZoom'
import { ScrollCue } from './ScrollCue'

// LP ヒーロー：スクロールで画像中央のドアへズームし、終盤に次セクションへブレンドする。
// 構造: track(縦長) → stage(sticky, 100svh) → 画像/ぼかし/スクリム/ブレンド + テキスト。
export function HeroScrollZoom() {
  const { trackRef, stageRef, reduced } = useHeroZoom({ targetScale: 3.8 })

  return (
    <section ref={trackRef} className="hero-track" data-reduced={reduced ? 'true' : 'false'}>
      <div
        ref={stageRef}
        className="hero-stage flex flex-col items-center justify-start px-6 pt-24 text-center md:pt-28"
      >
        {/* 背景画像（ズーム対象・最背面） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-palace.jpg" alt="" aria-hidden fetchPriority="high" decoding="async" className="hero-zoom" />
        {/* 宮殿の扉オーバーレイ：focal point に重ねズームで拡大→スクロールで観音開き・奥から光 */}
        <div aria-hidden className="hero-doors">
          <div className="hero-door-glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-door-left.png" alt="" decoding="async" className="hero-door hero-door--left" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-door-right.png" alt="" decoding="async" className="hero-door hero-door--right" />
        </div>
        {/* 流れる雲（上空・スクリムの下で馴染ませる。ズームでフェード） */}
        <div aria-hidden className="hero-clouds" />
        {/* 飛び回る渡鴉（ズームでフェード） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-raven.png" alt="" aria-hidden decoding="async" className="hero-raven" />
        {/* 下部のぼかし */}
        <div aria-hidden className="hero-blur" />
        {/* アイボリースクリム（可読性） */}
        <div aria-hidden className="hero-scrim" />
        {/* 次セクションへのブレンド（ズーム終盤でフェードイン） */}
        <div aria-hidden className="hero-blend" />
        {/* HA下端を下セクション(アイボリー)へ自然にフェード（直線も雲も無く馴染ませる） */}
        <div aria-hidden className="hero-bottom-fade" />

        {/* テキスト/CTA（最前面・ズームでフェードアウト） */}
        <div className="hero-content flex flex-col items-center">
          <p className="text-sm tracking-widest mb-4 font-medium" style={{ color: 'var(--palace)' }}>
            IMAGE PALACE
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ color: '#111111' }}>
            言葉をイメージに変えて、
            <br />
            頭に記憶の宮殿をつくる。
          </h1>
          <p className="text-base md:text-lg max-w-md mb-10" style={{ color: '#4A4A4A' }}>
            AIが単語を画像カードに変換。
            自分だけの記憶の宮殿を、少しずつ育てていけます。
          </p>
          <div className="flex w-full max-w-sm flex-col sm:w-auto sm:max-w-none sm:flex-row gap-3">
            <Link href="/signup" className="w-full sm:w-44">
              <Button
                size="lg"
                className="w-full px-8 text-base sm:w-44"
                style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
              >
                無料ではじめる
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-44">
              <Button size="lg" variant="outline" className="w-full px-8 text-base sm:w-44">
                ログイン
              </Button>
            </Link>
          </div>
        </div>

        {/* スクロール誘導（画像下部・他セクションと同位置） */}
        <ScrollCue targetId="concept" className="hero-cue" />
      </div>
    </section>
  )
}
