'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 見出し語とイメージが、いまの画面に収まる高さを出す。
 *
 * **隠すのではなく、縮める。** ほかの項目は下にそのまま並んでいる。
 * 開いた瞬間に絵の全体が見えるようにするための調整であって、
 * 何かを見せなくするための切り替えではない。
 *
 * 窓の大きさが変わったら測り直す。回転や分割表示で寸法が変わっても、
 * そのたびに合わせ直す。
 */
export function useFitToWindow(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | null>(null)

  useEffect(() => {
    // 切ったときも、次の順番で戻す（効果の中でそのまま書き換えると描き直しが連鎖する）
    if (!enabled) {
      const off = setTimeout(() => setMaxHeight(null), 0)
      return () => clearTimeout(off)
    }

    const measure = () => {
      const node = ref.current
      if (!node) return

      const top = node.getBoundingClientRect().top
      // 下に少し残す。ぴったりに詰めると、次に何かある気配が消える
      const available = window.innerHeight - top - RESERVED_BOTTOM
      setMaxHeight(Math.max(available, MIN_HEIGHT))
    }

    // 最初の1回は次の順番へ回す（描き終わってから測る）
    const first = setTimeout(measure, 0)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(first)
      window.removeEventListener('resize', measure)
    }
  }, [enabled])

  return { ref, maxHeight }
}

/** イメージの下の操作列と、次があると分かるだけの余白 */
const RESERVED_BOTTOM = 96
/** これ以下にすると、絵が何なのか分からなくなる */
const MIN_HEIGHT = 180
