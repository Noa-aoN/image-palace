'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { MiniMap } from '@xyflow/react'
import { GripHorizontal } from 'lucide-react'

const DEFAULT_SIZE = { w: 200, h: 150 }
const MIN_SIZE = { w: 120, h: 90 }
// ドラッグ用ハンドルバーの高さ（px）。ミニマップ本体はこのぶん下げる。
const HANDLE_H = 20

// フリーボードのミニマップを、ドラッグで移動・角ドラッグでリサイズできるようにするラッパー。
// 位置は既定で右下（pos=null）。一度ドラッグしたら left/top 指定に切り替える。
// ※右パネルの開閉に連動した位置調整は行わない（固定運用）。
export function DraggableMiniMap({ boardRef }: { boardRef: RefObject<HTMLDivElement | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [size, setSize] = useState(DEFAULT_SIZE)

  const startDrag = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const board = boardRef.current?.getBoundingClientRect()
    const el = containerRef.current?.getBoundingClientRect()
    if (!board || !el) return
    const offX = e.clientX - el.left
    const offY = e.clientY - el.top
    const move = (ev: PointerEvent) => {
      const left = ev.clientX - board.left - offX
      const top = ev.clientY - board.top - offY
      const maxL = board.width - size.w
      const maxT = board.height - size.h
      setPos({ left: Math.max(0, Math.min(maxL, left)), top: Math.max(0, Math.min(maxT, top)) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const board = boardRef.current?.getBoundingClientRect()
    const el = containerRef.current?.getBoundingClientRect()
    if (!board || !el) return
    // リサイズ中は現在位置を left/top に固定してから右下方向へ広げる
    const left = el.left - board.left
    const top = el.top - board.top
    setPos({ left, top })
    const move = (ev: PointerEvent) => {
      const w = Math.max(MIN_SIZE.w, Math.min(board.width - left, ev.clientX - board.left - left))
      const h = Math.max(MIN_SIZE.h, Math.min(board.height - top, ev.clientY - board.top - top))
      setSize({ w: Math.round(w), h: Math.round(h) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      ref={containerRef}
      className="board-noexport nodrag nopan absolute overflow-hidden rounded-lg border border-border shadow-sm"
      style={{
        ...(pos ? { left: pos.left, top: pos.top } : { right: 12, bottom: 12 }),
        width: size.w,
        height: size.h,
        zIndex: 5,
      }}
    >
      {/* ドラッグ用ハンドルバー */}
      <div
        onPointerDown={startDrag}
        title="ドラッグで移動"
        className="absolute inset-x-0 top-0 z-10 flex cursor-grab items-center justify-center bg-[var(--palace)]/80 active:cursor-grabbing"
        style={{ height: HANDLE_H }}
      >
        <GripHorizontal size={14} className="text-white" />
      </div>

      {/* MiniMap は style.width/height を px 数値で受け取り viewBox のスケール計算に使う。
          文字列（'100%' 等）を渡すと NaN になり描画が壊れるため、必ず数値を渡す。 */}
      <MiniMap
        pannable
        zoomable
        style={{
          position: 'absolute',
          left: 0,
          top: HANDLE_H,
          margin: 0,
          width: size.w,
          height: size.h - HANDLE_H,
        }}
      />

      {/* リサイズ用ハンドル（右下角） */}
      <div
        onPointerDown={startResize}
        title="ドラッグでサイズ変更"
        className="absolute bottom-0 right-0 z-10 h-3.5 w-3.5 cursor-nwse-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 0 50%, var(--palace) 50% 100%)',
        }}
      />
    </div>
  )
}
