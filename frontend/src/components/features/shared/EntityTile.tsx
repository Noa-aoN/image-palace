'use client'

import Link from 'next/link'
import { Circle, CircleCheck } from 'lucide-react'

/**
 * 一覧の1枚。選択中はリンクをボタンに差し替える。
 *
 * 選択中でも押すと移動してしまうと、押した先で「戻る」を強いられる。
 */
export function EntityTile({
  href,
  name,
  meta,
  cover,
  selecting,
  selected,
  onSelect,
}: {
  href: string
  name: string
  meta: string | null
  cover: React.ReactNode
  selecting: boolean
  selected: boolean
  onSelect: () => void
}) {
  const body = (
    <>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <span className="font-medium truncate">{name}</span>
        {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      </div>
      <div className="w-full aspect-square bg-muted overflow-hidden">{cover}</div>
    </>
  )

  const frame = `relative flex flex-col rounded-xl border overflow-hidden bg-card transition-shadow ${
    selected ? 'border-[var(--palace)] shadow-md' : 'border-border hover:shadow-md'
  }`

  if (!selecting) {
    return (
      <Link href={href} className={frame}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onSelect} className={`${frame} text-left`} aria-pressed={selected}>
      <span className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-0.5">
        {selected ? (
          <CircleCheck size={18} style={{ color: 'var(--palace)' }} />
        ) : (
          <Circle size={18} className="text-muted-foreground" />
        )}
      </span>
      {body}
    </button>
  )
}
