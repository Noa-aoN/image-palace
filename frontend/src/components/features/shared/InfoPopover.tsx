'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * ⓘ ボタンで開く小さな情報パネル。
 *
 * 学習そのものの中身ではないもの（生成情報・プロンプト情報など）は、
 * 常時表示せずここに畳む。
 *
 * 外側を押したときと Escape で閉じる。開けたものが閉じられないと、
 * 画面の一部が隠れたままになって邪魔になる。
 */
export function InfoPopover({
  label,
  icon,
  title,
  children,
  width = 'w-72',
  align = 'right',
}: {
  label: string
  icon: ReactNode
  /** パネル内の見出し。省略時は label を使う */
  title?: string
  children: ReactNode
  width?: string
  /** ボタンのどちら側を起点に開くか。行の左端に置くボタンは left にしないと画面外へ出る */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${label}を表示`}
        aria-expanded={open}
        className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {icon}
        {label}
      </button>

      {open && (
        <div
          // 幅は画面幅で頭打ちにする。細い端末では w-72/w-80 が画面から食み出すため
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} z-30 mt-2 ${width} max-w-[calc(100vw-2rem)] space-y-2 rounded-xl border border-border bg-card p-3 text-sm shadow-lg`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{title ?? label}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}
