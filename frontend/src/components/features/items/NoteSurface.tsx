import type { ReactNode } from 'react'

/**
 * カード詳細を載せる「ノート」の紙。
 *
 * カードの中身は、絵とその周りに書き足していった**手控え**に近い。
 * 地の上に札が直接並んでいると、1枚1枚が独立した部品に見えて、
 * 「1枚のカードについて書いたもの」というまとまりが出ない。
 *
 * 紙を1枚敷くと、載っているものが**同じ1枚についての記述**だと分かる。
 *
 * **ノートらしさは綴じ側の罫だけで出す。** 全面に罫を引くと、
 * 札の縁と罫が交差して、どちらも読みにくくなる。
 * 紙の色（`--note-surface`）は地と札の紙のあいだに置いてあるので、
 * 札は紙の上に載って見え、紙は地の上に敷かれて見える。
 */
export function NoteSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative rounded-2xl px-4 py-5 shadow-sm ring-1 ring-[var(--edge-gold-soft)] sm:px-8 sm:py-7"
      style={{ backgroundColor: 'var(--note-surface)' }}
    >
      {/* 綴じ側の罫。**狭い画面では引かない**（幅を削るほうが惜しい） */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-5 left-4 hidden w-px sm:block"
        style={{ backgroundColor: 'var(--note-rule)' }}
      />
      {children}
    </div>
  )
}
