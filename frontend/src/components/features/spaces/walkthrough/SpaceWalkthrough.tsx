'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Route, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMotion } from '@/hooks/useMotion'
import { useWalkthroughDriver } from './useWalkthroughDriver'
import { WalkthroughRoad } from './WalkthroughRoad'
import { WalkthroughRoom } from './WalkthroughRoom'
import { WalkthroughRoom3D } from './WalkthroughRoom3D'
import { type RoomStyle } from '@/lib/room-style'
import type { SpacePoint } from '@/types/space'
import { WalkthroughPanel } from './WalkthroughPanel'
import { DWELL_MS } from './constants'

// 切り替え速度の選択肢（押すたびに巡回）
const DWELL_STEPS = [1200, 1800, DWELL_MS, 4000, 6000]
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
  style,
  dims,
  spaceId,
  points,
  onClose,
}: {
  stops: WalkthroughStop[]
  title: string
  spaceType: string
  style: RoomStyle
  dims: { width: number; height: number; depth: number }
  spaceId?: string
  points?: SpacePoint[]
  onClose: () => void
}) {
  const motion = useMotion()
  const isRoad = spaceType === 'road'
  // ルームは 3D（一人称で巡る）と 2D（面パネルを順に）を最上流で切り替える
  const [roomMode, setRoomMode] = useState<'3d' | '2d'>('3d')
  // 3D の視点の遠さ（0=一人称で近い / 1=部屋の外から俯瞰）
  const [camDistance, setCamDistance] = useState(0.25)
  // 単語カードのパネル表示。景色だけ見たいときに畳める
  const [cardVisible, setCardVisible] = useState(true)
  // 自動再生の切り替え速度。押すたびに巡回する
  const [dwellMs, setDwellMs] = useState(DWELL_MS)
  const stageRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // 画像クリックで拡大表示するライトボックス。
  const [zoom, setZoom] = useState<{ url: string; alt: string } | null>(null)

  const driver = useWalkthroughDriver({ count: stops.length, motion, stageRef, dwellMs })

  // 戻る・進む・閉じるをキーボードでも。手が離れないぶん行き来しやすい
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') driver.prev()
      else if (e.key === 'ArrowRight') driver.next()
      else if (e.key === 'Escape') onClose()
      else if (e.key === ' ') {
        e.preventDefault()
        driver.togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [driver, onClose])

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
            <div className="absolute inset-0">
              {/* 部屋の上に重ねるので、下地を敷いて読めるようにする */}
              <div className="absolute inset-x-0 top-4 z-10 flex justify-center">
                <div className="flex items-center gap-1 rounded-full border border-border bg-card/85 p-1 shadow backdrop-blur">
                  {(['3d', '2d'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRoomMode(m)}
                      aria-pressed={roomMode === m}
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${
                        roomMode === m ? 'font-medium text-white' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      style={roomMode === m ? { background: 'var(--palace)' } : undefined}
                    >
                      {m === '3d' ? '3D（歩く）' : '2D（面ごと）'}
                    </button>
                  ))}
                </div>
              </div>
              {roomMode === '3d' ? (
                <div className="absolute inset-0">
                  <WalkthroughRoom3D
                    stops={stops}
                    activeIndex={driver.activeIndex}
                    style={style}
                    dims={dims}
                    distance={camDistance}
                  />
                  <label className="absolute inset-x-0 bottom-32 z-10 mx-auto flex w-full max-w-[320px] items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-2xs text-muted-foreground shadow backdrop-blur">
                    <span className="shrink-0">近く</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={camDistance}
                      onChange={(e) => setCamDistance(Number(e.target.value))}
                      className="flex-1 accent-[var(--palace)]"
                      aria-label="視点の遠さ"
                    />
                    <span className="shrink-0">俯瞰</span>
                  </label>
                </div>
              ) : (
                <WalkthroughRoom
                  stops={stops}
                  activeIndex={driver.activeIndex}
                  style={style}
                  spaceId={spaceId}
                  points={points}
                  dims={dims}
                />
              )}
            </div>
          )}
          {/* key でポイントごとに再マウントし、到着の演出を再生 */}
          {cardVisible && (
          <WalkthroughPanel
            key={driver.activeIndex}
            stop={activeStop}
            index={driver.activeIndex}
            total={stops.length}
            motion={motion}
            onZoom={(url, alt) => setZoom({ url, alt })}
          />
          )}
          <WalkthroughControls
            index={driver.activeIndex}
            total={stops.length}
            playing={driver.playing}
            motion={motion}
            onPrev={driver.prev}
            onNext={driver.next}
            onTogglePlay={driver.togglePlay}
            onSeek={driver.seek}
            onClose={onClose}
            cardVisible={cardVisible}
            onToggleCard={() => setCardVisible((v) => !v)}
            dwellMs={dwellMs}
            onCycleDwell={() =>
              setDwellMs((ms) => DWELL_STEPS[(DWELL_STEPS.indexOf(ms) + 1) % DWELL_STEPS.length] ?? DWELL_MS)
            }
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
