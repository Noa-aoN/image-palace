'use client'

import { useEffect, useRef } from 'react'

// LP の各セクション下部に「道」を敷き、スクロール進捗に応じてズーム＋ブラーで
// 道を進んでいるように見せる装飾レイヤー。進捗は CSS 変数 --road-p(0→1) に書き、
// 変形/ぼかしは CSS 側で行う（React 再描画なし・コンポジタで動く）。
// prefers-reduced-motion 時は listener を張らず静止表示にする。
export function RoadBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const section = el.closest('section')
    if (!section) return

    let raf = 0
    const update = () => {
      raf = 0
      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // セクション上端がビュー下端→上端へ移動する間を 0→1 とする（下へスクロール＝前進）
      const p = Math.min(1, Math.max(0, (vh - rect.top) / vh))
      el.style.setProperty('--road-p', p.toFixed(4))
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
      {/* 背景透過PNG。変形/ぼかしは CSS(.road-bg__img) 側で --road-p により駆動 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/road.png" alt="" className="road-bg__img" />
    </div>
  )
}
