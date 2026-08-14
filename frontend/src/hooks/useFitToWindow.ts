'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 見出し語とイメージが、いまの画面に収まる高さを出す。
 *
 * **隠すのではなく、縮める。** ほかの項目は下にそのまま並んでいる。
 * 開いた瞬間に絵の全体が見えるようにするための調整であって、
 * 何かを見せなくするための切り替えではない。
 *
 * 測る相手は**あとから現れる**（カードを読み込んでから絵が出る）。
 * 一度きりの計測だと、まだ何も無いところを測って終わってしまう。
 * 現れた時と、大きさが変わった時に測り直す。
 */
export function useFitToWindow(enabled: boolean) {
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const measure = useCallback(() => {
    const node = nodeRef.current
    if (!node) return

    const top = node.getBoundingClientRect().top
    // 下に少し残す。ぴったりに詰めると、次に何かある気配が消える
    const available = window.innerHeight - top - RESERVED_BOTTOM
    setMaxHeight(Math.max(available, MIN_HEIGHT))
  }, [])

  // 相手が現れた時に測る。ref を渡すだけだと、現れたことに気づけない
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node
      observerRef.current?.disconnect()
      if (!node || !enabled) return

      // 上にあるものの高さが変われば、収まる高さも変わる
      const observer = new ResizeObserver(() => measure())
      observer.observe(document.body)
      observerRef.current = observer
      requestAnimationFrame(measure)
    },
    [enabled, measure]
  )

  useEffect(() => {
    if (!enabled) {
      const off = setTimeout(() => setMaxHeight(null), 0)
      return () => clearTimeout(off)
    }

    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    const first = requestAnimationFrame(measure)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(first)
      observerRef.current?.disconnect()
    }
  }, [enabled, measure])

  return { ref, maxHeight }
}

/** イメージの下の操作列と、次があると分かるだけの余白 */
const RESERVED_BOTTOM = 120
/** これ以下にすると、絵が何なのか分からなくなる */
const MIN_HEIGHT = 180
