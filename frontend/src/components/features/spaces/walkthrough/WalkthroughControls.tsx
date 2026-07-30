'use client'

import { SkipBack, SkipForward, X, RotateCcw, Play, Pause, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WalkthroughControls({
  index,
  total,
  playing,
  motion,
  onPrev,
  onNext,
  onTogglePlay,
  onSeek,
  onClose,
  cardVisible,
  onToggleCard,
  dwellMs,
  onCycleDwell,
}: {
  index: number
  total: number
  playing: boolean
  motion: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePlay: () => void
  onSeek: (i: number) => void
  onClose: () => void
  /** 単語カードのパネルを出しているか */
  cardVisible: boolean
  onToggleCard: () => void
  /** 次の点へ進むまでの待ち時間(ms) */
  dwellMs: number
  onCycleDwell: () => void
}) {
  // 再生/一時停止（モーション ON かつ 2点以上のときのみ）
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
        aria-label="ウォークスルーを閉じる"
        className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-card/85 px-3 py-2 text-xs font-medium text-muted-foreground shadow-md backdrop-blur transition-colors hover:text-foreground"
      >
        <X size={16} />
        閉じる
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
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={playing ? '一時停止' : '再生'}
              className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-transform hover:scale-105"
              style={{ background: 'var(--palace)' }}
            >
              {playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
            </button>
          )}

          <Button size="icon" variant="ghost" onClick={onNext} disabled={index >= total - 1} aria-label="次へ">
            <SkipForward size={18} />
          </Button>
          <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
            {index + 1} / {total}
          </span>
          {showMode && (
            <button
              type="button"
              onClick={onCycleDwell}
              title="切り替え速度"
              aria-label={`切り替え速度 ${(dwellMs / 1000).toFixed(1)}秒。押すと変更`}
              className="rounded-full border border-border px-2 py-1 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground"
            >
              {(dwellMs / 1000).toFixed(1)}s
            </button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleCard}
            aria-label={cardVisible ? '単語カードを隠す' : '単語カードを表示'}
            aria-pressed={cardVisible}
            title={cardVisible ? '単語カードを隠す' : '単語カードを表示'}
          >
            {cardVisible ? <Eye size={17} /> : <EyeOff size={17} />}
          </Button>
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
