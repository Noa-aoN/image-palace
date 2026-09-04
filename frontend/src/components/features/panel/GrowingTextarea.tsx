'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * 打った量に合わせて伸びる文字入力。
 *
 * ## なぜ1行では足りないか
 *
 * 図形の文字は 2000 字まで入る。それを1行の欄で受けていたので、
 * **入れた文字の大半が見えないまま**だった。書き直すにも、
 * 横スクロールで目当ての場所を探すことになる。
 *
 * かといって最初から大きく開けると、パネルの他の設定が押し出される。
 * **既定は3行。中身が増えたぶんだけ伸び、上限で止めて中を巻く。**
 *
 * ## 上限の見せ方
 *
 * 残りが少なくなってから出す。最初から「0 / 2000」と出ていると、
 * 長く書くことを促されているように読める。**打てなくなる直前に、
 * 打てなくなることが分かる**のがいちばん親切。
 */
export function GrowingTextarea({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  minRows = 3,
  maxRows = 12,
  disabled,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  minRows?: number
  maxRows?: number
  disabled?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [overflowing, setOverflowing] = useState(false)

  // 高さは中身から測る。いったん auto に戻さないと、縮むときに前の高さが残る
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return

    const line = parseFloat(getComputedStyle(el).lineHeight) || 20
    const padding = el.offsetHeight - el.clientHeight + PADDING_Y
    el.style.height = 'auto'
    const max = line * maxRows + padding
    const next = Math.min(el.scrollHeight, max)
    el.style.height = `${next}px`
    setOverflowing(el.scrollHeight > max)
  }, [maxRows])

  useLayoutEffect(resize, [value, resize])

  const remaining = maxLength == null ? null : maxLength - value.length
  // 残りが1割を切ってから出す。最初から出ていると、長く書けと促して見える
  const showCount = remaining != null && maxLength != null && remaining <= maxLength * 0.1

  return (
    <div className="space-y-1">
      <textarea
        id={id}
        ref={ref}
        rows={minRows}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          overflowing ? 'overflow-y-auto' : 'overflow-y-hidden'
        }`}
      />
      {showCount && (
        <p className={`text-right text-2xs ${remaining <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {remaining <= 0 ? 'これ以上は入りません' : `残り ${remaining} 字`}
        </p>
      )}
    </div>
  )
}

/** py-2 の上下ぶん。高さを測るときに足りないと、打つたびに1px ずつ伸びる */
const PADDING_Y = 0
