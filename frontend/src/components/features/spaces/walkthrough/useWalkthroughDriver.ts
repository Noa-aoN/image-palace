'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { SPACING, TRAVEL_MS, DWELL_MS, easeInOutCubic } from './constants'

type Args = {
  count: number
  motion: boolean
  /** 次の点へ進むまでの停留時間(ms)。未指定は既定値 */
  dwellMs?: number
  // 道ステージ（ここに --sw-shift を書き込む）。room 型では null でも可（no-op）。
  stageRef: RefObject<HTMLDivElement | null>
}

export type WalkthroughDriver = {
  activeIndex: number
  phase: 'travel' | 'arrived'
  playing: boolean
  next: () => void
  prev: () => void
  seek: (i: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
}

/**
 * 進行度 progress（0→count-1）を rAF で滑らかに動かし、道ステージへ --sw-shift(px) を書き込む。
 * 到着で activeIndex を更新、自動再生時は停留後に次点へ。モーション OFF は即時（rAF なし）。
 */
export function useWalkthroughDriver({ count, motion, stageRef, dwellMs = DWELL_MS }: Args): WalkthroughDriver {
  // 再生中に変更しても次の停留から効くよう ref で持つ
  const dwellRefMs = useRef(dwellMs)
  useEffect(() => {
    dwellRefMs.current = dwellMs
  }, [dwellMs])
  const [activeIndex, setActiveIndex] = useState(0)
  const [phase, setPhase] = useState<'travel' | 'arrived'>('arrived')
  const [playing, setPlayingState] = useState(false)

  const progressRef = useRef(0)
  const activeRef = useRef(0)
  const rafRef = useRef(0)
  const dwellRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const playingRef = useRef(false)
  const motionRef = useRef(motion)
  const countRef = useRef(count)
  const goToRef = useRef<(i: number) => void>(() => {})

  useEffect(() => {
    motionRef.current = motion
  }, [motion])
  useEffect(() => {
    countRef.current = count
  }, [count])

  const write = useCallback(
    (p: number) => {
      stageRef.current?.style.setProperty('--sw-shift', (p * SPACING).toFixed(1))
    },
    [stageRef]
  )

  const setPlaying = useCallback((v: boolean) => {
    playingRef.current = v
    setPlayingState(v)
  }, [])

  const clearRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])
  const clearDwell = useCallback(() => {
    if (dwellRef.current) clearTimeout(dwellRef.current)
    dwellRef.current = undefined
  }, [])

  const scheduleDwell = useCallback(
    (from: number) => {
      clearDwell()
      dwellRef.current = setTimeout(() => {
        if (!playingRef.current) return
        if (from < countRef.current - 1) goToRef.current(from + 1)
        else setPlaying(false)
      }, dwellRefMs.current)
    },
    [clearDwell, setPlaying]
  )

  const arrive = useCallback(
    (target: number) => {
      progressRef.current = target
      write(target)
      activeRef.current = target
      setActiveIndex(target)
      setPhase('arrived')
      if (playingRef.current) scheduleDwell(target)
    },
    [scheduleDwell, write]
  )

  const goTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(countRef.current - 1, i))
      clearRaf()
      clearDwell()
      if (!motionRef.current) {
        arrive(target)
        return
      }
      const from = progressRef.current
      if (Math.abs(from - target) < 0.001) {
        arrive(target)
        return
      }
      setPhase('travel')
      let startTs = 0
      const tick = (ts: number) => {
        if (!startTs) startTs = ts
        const t = Math.min(1, (ts - startTs) / TRAVEL_MS)
        progressRef.current = from + (target - from) * easeInOutCubic(t)
        write(progressRef.current)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          rafRef.current = 0
          arrive(target)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [arrive, clearDwell, clearRaf, write]
  )

  useEffect(() => {
    goToRef.current = goTo
  }, [goTo])

  const next = useCallback(() => {
    setPlaying(false)
    clearDwell()
    goTo(activeRef.current + 1)
  }, [clearDwell, goTo, setPlaying])
  const prev = useCallback(() => {
    setPlaying(false)
    clearDwell()
    goTo(activeRef.current - 1)
  }, [clearDwell, goTo, setPlaying])
  const seek = useCallback(
    (i: number) => {
      setPlaying(false)
      clearDwell()
      goTo(i)
    },
    [clearDwell, goTo, setPlaying]
  )
  // 手動（一時停止）: 停留のみ止める（進行中のトラベルは完走させる）。
  const pause = useCallback(() => {
    setPlaying(false)
    clearDwell()
  }, [clearDwell, setPlaying])
  // 自動再生: 末尾なら最初から、それ以外は現在地から停留を挟んで次へ進む。
  const play = useCallback(() => {
    setPlaying(true)
    const at = activeRef.current
    if (at >= countRef.current - 1) goTo(0)
    else scheduleDwell(at)
  }, [goTo, scheduleDwell, setPlaying])
  const togglePlay = useCallback(() => {
    if (playingRef.current) pause()
    else play()
  }, [pause, play])

  // マウント時: 先頭に立つだけ。再生は利用者が再生ボタンを押してから始める。
  useEffect(() => {
    write(0)
    progressRef.current = 0
    activeRef.current = 0
    setActiveIndex(0)
    setPhase('arrived')
    return () => {
      clearRaf()
      clearDwell()
    }
    // マウント時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { activeIndex, phase, playing, next, prev, seek, play, pause, togglePlay }
}
