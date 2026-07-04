'use client'

import { useEffect, useRef } from 'react'

// 「続く1本の道を歩く」体験。縦にタイルできる平坦な道テクスチャを repeat-y で敷き、
// ページ全体のスクロール量に応じて背景を縦スクロール（トレッドミル）させる。
// repeat-y が継ぎ目なく折り返すため無限ループになり、全セクションが同一オフセットを
// 参照するので「同じ1本の道が全ページを貫いて続く」ように見える。
// prefers-reduced-motion 時は listener を張らず静止。

const SPEED = 0.6 // スクロール量に対する道の流れる速さ（歩行速度）

export function RoadBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const update = () => {
      raf = 0
      // 下へスクロール＝道が手前(下)へ流れる＝前進。repeat-y が自動で折り返す。
      el.style.setProperty('--road-shift', (window.scrollY * SPEED).toFixed(1))
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
    <div ref={ref} aria-hidden className="road-bg">
      {/* 平坦な道テクスチャ（透過PNG）を repeat-y で敷き、background-position を scroll で動かす */}
      <div className="road-bg__strip" />
      {/* 上端（奥）を強くぼかして遠くへ霞ませる */}
      <div className="road-blur road-blur--top" />
      {/* 下端の軽いブラー帯（HA ヒーローの hero-blur 踏襲。手前の被写界深度） */}
      <div className="road-blur" />
    </div>
  )
}
