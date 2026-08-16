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
        // 上端に寄せていたころは、画面の上3分の1に文字が固まり、
        // 下の絵だけが広く空いていた。読むものを画面の中心寄りへ下ろす
        // （スクロール誘導は絶対配置なので、下げても押し出さない）
        className="hero-stage flex flex-col items-center justify-start px-6 pt-[7vh] text-center sm:pt-[10vh] md:pt-[13vh]"
      >
        {/* 背景画像（ズーム対象・最背面） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-palace.webp?v=2" alt="" aria-hidden fetchPriority="high" decoding="async" className="hero-zoom" />
        {/* 宮殿の扉オーバーレイ：focal point に重ねズームで拡大→スクロールで観音開き・奥から光。
            扉は厚みエッジ付きの3Dパネル。開くほどフレア（光条）が扉の奥から輝く */}
        <div aria-hidden className="hero-doors">
          <div className="hero-door-glow" />
          {/* 各扉は前面/背面＋4辺の木口からなる3Dスラブ。既存の扉画像を前面・背面
              （鏡像・暗め）のテクスチャとして使い、厚みのある板として開閉する */}
          <div className="hero-door-panel hero-door-panel--left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-left.webp?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--front hero-door-face--left" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-left.webp?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--back hero-door-face--left" />
            <span className="hero-door-edge hero-door-edge--seam-left" />
            <span className="hero-door-edge hero-door-edge--top" />
            <span className="hero-door-edge hero-door-edge--bottom" />
          </div>
          <div className="hero-door-panel hero-door-panel--right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-right.webp?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--front hero-door-face--right" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-door-right.webp?v=2" alt="" decoding="async" className="hero-door-face hero-door-face--back hero-door-face--right" />
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
        <img src="/hero-raven.webp" alt="" aria-hidden decoding="async" className="hero-raven" />
        {/* 下部の植物周りを舞う蝶々（外=スクロールで左右へ画面外／中=飛行経路／内=羽ばたき） */}
        <div aria-hidden className="hero-butterfly hero-butterfly--1">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-orange.webp" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--2">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-pink.webp" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--3">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-blue.webp" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--4">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-green.webp" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--5">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-white.webp" alt="" decoding="async" className="hero-butterfly__wing" />
          </div>
        </div>
        <div aria-hidden className="hero-butterfly hero-butterfly--6">
          <div className="hero-butterfly__path">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-butterfly-black.webp" alt="" decoding="async" className="hero-butterfly__wing" />
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
          {/* 大きさで読む順を決める。**名前 → 何をするか → どう使えるか**。
              いちばん大きいものが名前でないと、初めての人は何を見ているのか分からない */}
          <p
            className="brand-wordmark mb-3 text-[clamp(2.25rem,10vw,5.25rem)] leading-none md:mb-4"
            style={{ color: 'var(--palace)' }}
          >
            IMAGE PALACE
          </p>
          <h1
            className="mb-4 text-[clamp(1.3rem,5vw,2.1rem)] font-bold leading-snug tracking-tight md:mb-6 md:text-4xl"
            style={{ color: 'var(--foreground)' }}
          >
            言葉をイメージに変えて、
            <br />
            記憶の宮殿をつくる。
          </h1>
          {/* 絵の上に直接置くと、背景の明暗で読めなくなる。**紙を1枚敷く**。
              地・縁・角は `--landing-panel-*`（スクロール誘導と同じ紙）。
              白を薄くして絵を透かし、そのぶん縁を金にして輪郭を保つ */}
          <div
            className="mb-6 max-w-lg px-6 py-4 text-left shadow-sm backdrop-blur-sm md:mb-8 md:max-w-xl md:py-5"
            style={{
              background: 'var(--landing-panel-bg)',
              border: '1px solid var(--landing-panel-border)',
              borderRadius: 'var(--landing-panel-radius)',
            }}
          >
            {/* 3段構え。**何ができるか → どう使えるか → 続けると何になるか**。
                順番を入れ替えない。使い道から始めると、何を作る話なのか分からないまま
                用途だけが並ぶ */}
            <p className="text-[0.9rem] leading-relaxed md:text-lg" style={{ color: 'var(--foreground)' }}>
              覚えたい言葉や、残しておきたいことを書くと、AI がその内容をイメージにしてくれます。
              言葉とイメージがひとつになった<strong className="font-semibold">カード</strong>が、
              ImagePalace の基本単位です。
            </p>
            {/* 用途は、書かれた区切りのまま改行する。
                一続きにすると、暗記の道具にも記録の道具にもなることが読み流される */}
            <p className="mt-3 text-[0.85rem] leading-relaxed md:text-base" style={{ color: '#5A5348' }}>
              使い方は自由。
              <br />
              単語帳や用語集での暗記、図鑑・相関図・年表づくり。
              <br />
              絵日記、タスク管理、ビジョンボード。
              <br />
              学びにも、記録にも、整理にも、思いついた形で使えます。
            </p>
            <p className="mt-3 text-[0.85rem] leading-relaxed md:text-base" style={{ color: '#5A5348' }}>
              作ったカードは、自分の「宮殿」に並べて、整理して、組み合わせて、反復練習。
              集めたカードが、そのまま自分だけの知識と記憶の宮殿になっていきます。
            </p>
          </div>
          <LandingCta className="flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row" />
        </div>

        {/* スクロール誘導（画像下部・他セクションと同位置） */}
        <ScrollCue targetId="concept" className="hero-cue" />
      </div>
    </section>
  )
}
