'use client'

import { useEffect, useRef, useState } from 'react'

export interface HeroZoomOptions {
  /** ズーム到達倍率（progress=1 のときの scale） */
  targetScale?: number
  /** テキスト/スクリムが消えきる進捗（0〜1） */
  fadeEnd?: number
  /** 次セクションへのブレンドを始める進捗（0〜1） */
  blendStart?: number
  /** 画像のぼかしを始める進捗（拡大の粗さをマスク・0〜1） */
  blurStart?: number
  /** progress=1 でのぼかし量(px) */
  maxBlurPx?: number
  /** 扉が開き始める進捗（0〜1） */
  doorOpenStart?: number
  /** 扉が開ききる進捗（0〜1） */
  doorOpenEnd?: number
  /** 扉が開き切ったあと、中心へ追いズームを始める進捗（0〜1）。
      既定は doorOpenEnd と同じ＝全開と同時に始まる */
  doorBoostStart?: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const easeInQuad = (p: number) => p * p

/**
 * LP ヒーローのスクロール連動ズーム。
 * sticky な track の bounding rect から進捗(0→1)を計算し、stage 要素へ
 * CSS 変数（--zoom / --fade / --blend）を毎フレーム書き込む（React 再描画なし＝コンポジタのみで滑らか）。
 * prefers-reduced-motion 時はリスナーを張らず、CSS 側で静的化する。
 */
export function useHeroZoom(opts: HeroZoomOptions = {}) {
  const {
    targetScale = 2.6,
    fadeEnd = 0.55,
    blendStart = 0.7,
    blurStart = 0.55,
    maxBlurPx = 5,
    doorOpenStart = 0.5,
    doorOpenEnd = 0.9,
    doorBoostStart = doorOpenEnd,
  } = opts
  const trackRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyReduced = () => setReduced(mq.matches)
    applyReduced()
    mq.addEventListener('change', applyReduced)

    let ticking = false
    let rafId = 0

    const update = () => {
      ticking = false
      const track = trackRef.current
      const stage = stageRef.current
      if (!track || !stage) return

      // 読み取り（先にまとめて）
      const rect = track.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const progress = scrollable > 0 ? clamp(-rect.top / scrollable, 0, 1) : 0

      // 計算
      const scale = 1 + easeInQuad(progress) * (targetScale - 1)
      const fade = clamp(progress / fadeEnd, 0, 1)
      const blend = clamp((progress - blendStart) / (1 - blendStart), 0, 1)
      // 55%まで鮮明→頂点で柔らかく（拡大の粗さをマスク）
      const blurRamp = clamp((progress - blurStart) / (1 - blurStart), 0, 1)
      // 扉の開き（ズームが寄ってから開く）。滑らかに加減速。
      const doorRamp = clamp((progress - doorOpenStart) / (doorOpenEnd - doorOpenStart), 0, 1)
      const doorOpen = doorRamp * doorRamp * (3 - 2 * doorRamp) // smoothstep
      // 全開後の追いズーム（加速しながら扉中心へ寄り続ける）
      const doorBoost = easeInQuad(clamp((progress - doorBoostStart) / (1 - doorBoostStart), 0, 1))

      // 書き込み（後でまとめて＝レイアウトスラッシュ回避）
      stage.style.setProperty('--zoom', String(scale))
      stage.style.setProperty('--fade', String(fade))
      stage.style.setProperty('--blend', String(blend))
      stage.style.setProperty('--blurpx', `${easeInQuad(blurRamp) * maxBlurPx}px`)
      stage.style.setProperty('--zoombright', String(1 + blurRamp * 0.08))
      stage.style.setProperty('--dooropen', String(doorOpen))
      stage.style.setProperty('--doorboost', String(doorBoost))
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      rafId = requestAnimationFrame(update)
    }

    // reduced のときはズーム駆動しない（CSS のメディアクエリで静的化される）
    if (!mq.matches) {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })
      update()
    }

    return () => {
      mq.removeEventListener('change', applyReduced)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [targetScale, fadeEnd, blendStart, blurStart, maxBlurPx, doorOpenStart, doorOpenEnd, doorBoostStart])

  return { trackRef, stageRef, reduced }
}
