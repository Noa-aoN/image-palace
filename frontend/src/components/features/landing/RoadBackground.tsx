'use client'

import { useEffect, useRef } from 'react'

// 「続く1本の道を歩く」体験。ページ全体のスクロール量から連続位相を算出し、
// 2枚の道画像をクロスフェードしながら手前へドリー（ズーム）させることで、
// セクション境界でリセットせず・継ぎ目なく前進し続けるループにする。
// 全ロード要素が同一の window.scrollY を参照するため互いに同期する。
// prefers-reduced-motion 時は listener を張らず静止（CSS 変数のフォールバックで1枚表示）。

const LOOP_DISTANCE = 620 // このpxスクロールで道が1周（手前へ流れる）＝歩行速度
const MAX_SCALE = 1.9 // ドリーの最大ズーム
const BASE_OPACITY = 0.72 // クロスフェードのピーク不透明度

const mod = (n: number, m: number) => ((n % m) + m) % m

export function RoadBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const update = () => {
      raf = 0
      const phaseA = mod(window.scrollY / LOOP_DISTANCE, 1)
      const phaseB = mod(phaseA + 0.5, 1) // Bは半周ずらし＝常にどちらかが可視
      el.style.setProperty('--road-scale-a', (1 + (MAX_SCALE - 1) * phaseA).toFixed(4))
      el.style.setProperty('--road-scale-b', (1 + (MAX_SCALE - 1) * phaseB).toFixed(4))
      // 端(0,1)で0・中央(0.5)で最大の三角状フェードで継ぎ目を隠す
      el.style.setProperty('--road-opa-a', (BASE_OPACITY * Math.sin(phaseA * Math.PI)).toFixed(4))
      el.style.setProperty('--road-opa-b', (BASE_OPACITY * Math.sin(phaseB * Math.PI)).toFixed(4))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div ref={ref} aria-hidden className="road-bg">
        {/* 2枚を半周ずらしてクロスフェード＝継ぎ目レスな無限ドリー（HAドア同様 CSS変数駆動） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/road.png" alt="" className="road-bg__img road-bg__img--a" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/road.png" alt="" className="road-bg__img road-bg__img--b" />
      </div>
      {/* 下端の軽いブラー帯（HA ヒーローの hero-blur を踏襲。手前の被写界深度） */}
      <div aria-hidden className="road-blur" />
    </>
  )
}
