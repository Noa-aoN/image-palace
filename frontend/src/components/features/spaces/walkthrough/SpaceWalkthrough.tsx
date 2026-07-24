'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Route, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMotion } from '@/hooks/useMotion'
import { useWalkthroughDriver } from './useWalkthroughDriver'
import { WalkthroughRoad } from './WalkthroughRoad'
import { WalkthroughRoom } from './WalkthroughRoom'
import { WalkthroughPanel } from './WalkthroughPanel'
import { WalkthroughControls } from './WalkthroughControls'
import type { WalkthroughStop } from './constants'

/**
 * スペースのウォークスルー・プレイヤー（全画面オーバーレイ）。
 * ロード型は一人称の道（背景＝ロキ点／手前＝結合カード）、ルーム型は簡易背景でカードをめくる。
 * スペース詳細・space_map ビューの双方から、正規化した stops を渡して使う。
 */
export function SpaceWalkthrough({
  stops,
  title,
  spaceType,
  onClose,
}: {
  stops: WalkthroughStop[]
  title: string
  spaceType: string
  onClose: () => void
}) {
  const motion = useMotion()
  const isRoad = spaceType === 'road'
  const stageRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // 画像クリックで拡大表示するライトボックス。
  const [zoom, setZoom] = useState<{ url: string; alt: string } | null>(null)

  const driver = useWalkthroughDriver({ count: stops.length, motion, stageRef })

  // 開いた要素を覚え、ダイアログへフォーカス。閉じたら元の要素へ戻す。
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => prevFocus?.focus?.()
  }, [])

  // 背後のスクロールをロック。
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // キーボード操作。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 拡大表示中は Esc で拡大だけ閉じ、他の操作は無効。
      if (zoom) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setZoom(null)
        }
        return
      }
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        driver.next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        driver.prev()
      } else if (e.key === ' ') {
        e.preventDefault()
        if (motion && stops.length > 1) driver.togglePlay()
      } else if (e.key === 'Home') {
        driver.seek(0)
      } else if (e.key === 'End') {
        driver.seek(stops.length - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [driver, motion, onClose, stops.length, zoom])

  if (typeof document === 'undefined') return null

  const activeStop = stops[driver.activeIndex] ?? null

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} のウォークスルー`}
      tabIndex={-1}
      className="fixed inset-0 z-[60] overflow-hidden outline-none"
      style={{
        background:
          'linear-gradient(to bottom, color-mix(in srgb, var(--palace) 9%, var(--background)) 0%, var(--background) 46%)',
      }}
    >
      {stops.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
          <Route size={40} style={{ color: 'var(--palace)' }} />
          <p>まだポイントがありません。</p>
          <Button variant="outline" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>
      ) : (
        <>
          {isRoad ? (
            <WalkthroughRoad stops={stops} stageRef={stageRef} activeIndex={driver.activeIndex} />
          ) : (
            <WalkthroughRoom />
          )}
          {/* key でポイントごとに再マウントし、到着の演出を再生 */}
          <WalkthroughPanel
            key={driver.activeIndex}
            stop={activeStop}
            index={driver.activeIndex}
            total={stops.length}
            motion={motion}
            onZoom={(url, alt) => setZoom({ url, alt })}
          />
          <WalkthroughControls
            index={driver.activeIndex}
            total={stops.length}
            playing={driver.playing}
            motion={motion}
            onPrev={driver.prev}
            onNext={driver.next}
            onPlay={driver.play}
            onPause={driver.pause}
            onSeek={driver.seek}
            onClose={onClose}
          />
        </>
      )}

      {/* 画像の拡大表示（クリックで開閉） */}
      {zoom && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
          aria-label="画像を拡大"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.url} alt={zoom.alt} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="閉じる"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
