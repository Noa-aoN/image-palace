'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useHeroZoom } from '@/hooks/useHeroZoom'
import { signOut } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { ScrollCue } from './ScrollCue'

// LP ヒーロー：スクロールで画像中央のドアへズームし、終盤に次セクションへブレンドする。
// 構造: track(縦長) → stage(sticky, 100svh) → 画像/ぼかし/スクリム/ブレンド + テキスト。
export function HeroScrollZoom() {
  const { trackRef, stageRef, reduced } = useHeroZoom({ targetScale: 9, blurStart: 0.42 })

  // セッションが残っているログイン済みユーザーには CTA を出し分ける。
  // ハイドレーション確定前は認証UIを出さない（Header と同じ hasHydrated 方式でちらつき防止）。
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)
  const showAuthed = hasHydrated && isAuthenticated

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      // トークン切れでも clearAuth は実行する
    }
    resetItems()
    clearAuth()
    // LP 上なのでリダイレクトせず、CTA が未ログイン向けに切り替わるだけにする。
  }

  return (
    <section ref={trackRef} className="hero-track" data-reduced={reduced ? 'true' : 'false'}>
      <div
        ref={stageRef}
        className="hero-stage flex flex-col items-center justify-start px-6 pt-24 text-center md:pt-28"
      >
        {/* 背景画像（ズーム対象・最背面） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-palace.jpg?v=2" alt="" aria-hidden fetchPriority="high" decoding="async" className="hero-zoom" />
        {/* 宮殿の扉オーバーレイ：focal point に重ねズームで拡大→スクロールで観音開き・奥から光 */}
        <div aria-hidden className="hero-doors">
          <div className="hero-door-glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-door-left.png?v=2" alt="" decoding="async" className="hero-door hero-door--left" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-door-right.png?v=2" alt="" decoding="async" className="hero-door hero-door--right" />
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
          <div
            className={`flex w-full max-w-sm flex-col sm:w-auto sm:max-w-none sm:flex-row gap-3 ${
              hasHydrated ? '' : 'invisible'
            }`}
          >
            {showAuthed ? (
              <>
                <Link href="/entrance" className="w-full sm:w-44">
                  <Button
                    size="lg"
                    className="w-full px-8 text-base sm:w-44"
                    style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
                  >
                    宮殿に入る
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full px-8 text-base sm:w-44"
                >
                  ログアウト
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* スクロール誘導（画像下部・他セクションと同位置） */}
        <ScrollCue targetId="concept" className="hero-cue" />
      </div>
    </section>
  )
}
