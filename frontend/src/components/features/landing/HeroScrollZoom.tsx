'use client'

import { useHeroZoom } from '@/hooks/useHeroZoom'
import { LandingCta } from './LandingCta'
import { ScrollCue } from './ScrollCue'

// LP ヒーロー：スクロールで画像中央のドアへズームし、終盤に次セクションへブレンドする。
// 構造: track(縦長) → stage(sticky, 100svh) → 画像/ぼかし/スクリム/ブレンド + テキスト。
export function HeroScrollZoom() {
  // doorOpenEnd 0.85: 扉が開き切ったあとトラック終端まで余韻を残し（track 175vh とセット）、
  // ホワイトアウトの中をゆっくり進んでから次セクションの道へ繋ぐ
  const { trackRef, stageRef, reduced } = useHeroZoom({ targetScale: 9, blurStart: 0.42, doorOpenEnd: 0.85 })

  return (
    <section ref={trackRef} className="hero-track" data-reduced={reduced ? 'true' : 'false'}>
      <div
        ref={stageRef}
        className="hero-stage flex flex-col items-center justify-start px-6 pt-24 text-center md:pt-28"
      >
        {/* 背景画像（ズーム対象・最背面） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-palace.jpg?v=2" alt="" aria-hidden fetchPriority="high" decoding="async" className="hero-zoom" />
        {/* 宮殿の扉オーバーレイ：focal point に重ねズームで拡大→スクロールで観音開き・奥から光。
            扉は厚みエッジ付きの3Dパネル。開くほどフレア（光条）が扉の奥から輝く */}
        <div aria-hidden className="hero-doors">
          <div className="hero-door-glow" />
          {/* 各扉は前面/背面＋4辺の木口からなる3Dスラブ。既存の扉画像を前面・背面
              （鏡像・暗め）のテクスチャとして使い、厚みのある板として開閉する */}
          <div className="hero-door-panel hero-door-panel--left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-left.png?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--front hero-door-face--left" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-left.png?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--back hero-door-face--left" />
            <span className="hero-door-edge hero-door-edge--seam-left" />
            <span className="hero-door-edge hero-door-edge--top" />
            <span className="hero-door-edge hero-door-edge--bottom" />
          </div>
          <div className="hero-door-panel hero-door-panel--right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-right.png?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--front hero-door-face--right" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-right.png?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--back hero-door-face--right" />
            <span className="hero-door-edge hero-door-edge--seam-right" />
            <span className="hero-door-edge hero-door-edge--top" />
            <span className="hero-door-edge hero-door-edge--bottom" />
          </div>
          {/* 開扉に連動して輝くフレア。不規則な光芒2層＋アナモルフィック光条（ハロ＋芯）＋
              リングハロ＋コアの多層構成で、レンズフレアらしい柔らかい輝きにする */}
          <div className="hero-flare">
            <span className="hero-flare__rays hero-flare__rays--a" />
            <span className="hero-flare__rays hero-flare__rays--b" />
            <span className="hero-flare__streak hero-flare__streak--v" />
            <span className="hero-flare__streak hero-flare__streak--h" />
            <span className="hero-flare__streak hero-flare__streak--h-core" />
            <span className="hero-flare__halo" />
            <span className="hero-flare__core" />
          </div>
        </div>
        {/* 流れる雲（上空・スクリムの下で馴染ませる。ズームでフェード） */}
        <div aria-hidden className="hero-clouds" />
        {/* 飛び回る渡鴉（ズームでフェード） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-raven.png" alt="" aria-hidden decoding="async" className="hero-raven" />
        {/* 下部の植物周りを舞う蝶々（外=スクロールで左右へ画面外／中=飛行経路／内=羽ばたき） */}
        <div aria-hidden className="hero-butterfly hero-butterfly--1">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-orange.png" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--2">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-pink.png" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--3">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-blue.png" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--4">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-green.png" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--5">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-white.png" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--6">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-black.png" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        {/* 下部のぼかし */}
        <div aria-hidden className="hero-blur" />
        {/* アイボリースクリム（可読性） */}
        <div aria-hidden className="hero-scrim" />
        {/* 次セクションへのブレンド（ズーム終盤でフェードイン） */}
        <div aria-hidden className="hero-blend" />
        {/* 終盤に白っぽく光が満ちる（扉が開いた先へ吸い込まれる感じ） */}
        <div aria-hidden className="hero-whiteout" />
        {/* HA下端を下セクション(アイボリー)へ自然にフェード（直線も雲も無く馴染ませる） */}
        <div aria-hidden className="hero-bottom-fade" />

        {/* テキスト/CTA（最前面・ズームでフェードアウト） */}
        <div className="hero-content flex flex-col items-center">
          <p className="text-sm tracking-widest mb-4 font-medium" style={{ color: 'var(--palace)' }}>
            IMAGE PALACE
          </p>
          <h1 className="text-[clamp(1.5rem,7vw,2.25rem)] md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ color: '#111111' }}>
            言葉をイメージに変えて、
            <br />
            記憶の宮殿をつくる。
          </h1>
          <p className="text-base md:text-lg max-w-md mb-10" style={{ color: '#4A4A4A' }}>
            AIが単語を画像カードに変換。
            <br />
            自分だけの記憶の宮殿を、少しずつ育てていけます。
          </p>
          <LandingCta className="flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row" />
        </div>

        {/* スクロール誘導（画像下部・他セクションと同位置） */}
        <ScrollCue targetId="concept" className="hero-cue" />
      </div>
    </section>
  )
}
