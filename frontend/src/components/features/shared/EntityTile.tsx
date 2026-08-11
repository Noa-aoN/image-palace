'use client'

import Link from 'next/link'
import { Circle, CircleCheck } from 'lucide-react'

/**
 * 一覧の1枚。選択中は移動せず、押すと選択が切り替わる。
 *
 * 選択中でも押すと移動してしまうと、押した先で「戻る」を強いられる。
 *
 * 選択中の押し先は、札そのものではなく**上に重ねた1枚のボタン**にする。
 * 札を `<button>` にすると、表紙の中にある送りボタン（EntityCover）が
 * ボタンの入れ子になり、HTML として不正になる（水和も壊れる）。
 * 重ねる形なら、選択中は送りボタンが下に隠れて押せなくなる。
 * これは都合の悪い副作用ではなく、選んでいる最中に表紙をめくられても困るので望ましい。
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
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="truncate font-medium">{name}</span>
        {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      </div>
      <div className="aspect-square w-full overflow-hidden bg-muted">{cover}</div>
    </>
  )

  const frame = `relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow ${
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
    <div className={frame}>
      {body}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${name} を選ぶ`}
        className="absolute inset-0 z-10"
      >
        <span className="absolute right-2 top-2 rounded-full bg-background/90 p-0.5">
          {selected ? (
            <CircleCheck size={18} style={{ color: 'var(--palace)' }} />
          ) : (
            <Circle size={18} className="text-muted-foreground" />
          )}
        </span>
      </button>
    </div>
  )
}
