'use client'

import { useEffect, useState } from 'react'

export interface AreaBox {
  /** 表示されている本文領域の縦の中央（画面座標） */
  centerY: number
  left: number
  right: number
}

/**
 * いま見えている本文領域（スクロールする `<main>`）の位置。
 *
 * ページ送りの矢印を「中身の中央」に置くと、長いページでは画面外まで下がってしまう。
 * 置きたいのは**見えている領域の中央**なので、そこだけは実測する。
 *
 * CSS だけでは書けない。`position: sticky` の基準はスクロール枠の上端で、
 * 「枠の高さの半分」を CSS から参照する術が無い。サイドバーの幅も畳めば変わる。
 *
 * 監視するのは大きさと画面の変化だけ。スクロールでは動かない（枠は動かないため）。
 */
export function useMainAreaBox(): AreaBox | null {
  const [box, setBox] = useState<AreaBox | null>(null)

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const measure = () => {
      const rect = main.getBoundingClientRect()
      setBox({ centerY: rect.top + rect.height / 2, left: rect.left, right: window.innerWidth - rect.right })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return box
}
