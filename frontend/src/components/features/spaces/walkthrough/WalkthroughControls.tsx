'use client'

import { SkipBack, SkipForward, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WalkthroughControls({
  index,
  total,
  playing,
  motion,
  onPrev,
  onNext,
  onPlay,
  onPause,
  onSeek,
  onClose,
}: {
  index: number
  total: number
  playing: boolean
  motion: boolean
  onPrev: () => void
  onNext: () => void
  onPlay: () => void
  onPause: () => void
  onSeek: (i: number) => void
  onClose: () => void
}) {
  // 自動/手動の切替（モーション ON かつ 2点以上のときのみ）
  const showMode = motion && total > 1
  const frac = total > 1 ? index / (total - 1) : 0

  const seekFromClientX = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(Math.round(r * (total - 1)))
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-4 top-4 z-20 rounded-full bg-card/80 p-2 text-muted-foreground shadow-md backdrop-blur transition-colors hover:text-foreground"
      >
        <X size={20} />
      </button>

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2.5 pb-5">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-3 py-1.5 shadow-lg backdrop-blur">
          <Button size="icon" variant="ghost" onClick={() => onSeek(0)} disabled={index <= 0} aria-label="最初へ">
            <RotateCcw size={17} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onPrev} disabled={index <= 0} aria-label="前へ">
            <SkipBack size={18} />
          </Button>

          {showMode && (
            <div className="mx-0.5 flex items-center overflow-hidden rounded-full border border-border text-xs">
              <button
                type="button"
                onClick={onPlay}
                aria-pressed={playing}
                className={`px-2.5 py-1 font-medium transition-colors ${playing ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                style={playing ? { background: 'var(--palace)' } : undefined}
              >
                自動
              </button>
              <button
                type="button"
                onClick={onPause}
                aria-pressed={!playing}
                className={`px-2.5 py-1 font-medium transition-colors ${!playing ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                style={!playing ? { background: 'var(--palace)' } : undefined}
              >
                手動
              </button>
            </div>
          )}

          <Button size="icon" variant="ghost" onClick={onNext} disabled={index >= total - 1} aria-label="次へ">
            <SkipForward size={18} />
          </Button>
          <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
            {index + 1} / {total}
          </span>
        </div>

        {/* スクラブ可能なプログレスバー（クリック/ドラッグで任意の地点へ戻れる） */}
        {total > 1 && (
          <div
            role="slider"
            aria-label="再生位置"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
            tabIndex={0}
            onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              seekFromClientX(e.clientX, e.currentTarget)
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) seekFromClientX(e.clientX, e.currentTarget)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                onPrev()
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                onNext()
              }
            }}
            className="relative h-4 w-64 max-w-[80vw] cursor-pointer touch-none select-none"
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)]" />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{ width: `${frac * 100}%`, background: 'var(--palace)' }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${frac * 100}%`, background: 'var(--palace)' }}
            />
          </div>
        )}
      </div>
    </>
  )
}
