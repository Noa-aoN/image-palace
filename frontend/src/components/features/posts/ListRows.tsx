import Link from 'next/link'
import { Clock, Pin } from 'lucide-react'

/**
 * 読みもの一覧の1行。お知らせ・使い方・コラム・掲示板で共通に使う。
 */
export interface ListRowItem {
  key: string
  href: string
  title: string
  excerpt?: string | null
  /** ISO 文字列。持たないもの（使い方）は省く */
  date?: string | null
  readingMinutes?: number | null
  /** 種別など、行の頭に出す短い札。同じ種類だけが並ぶ面では付けない */
  badge?: string | null
  pinned?: boolean
}

/**
 * 読みものを **1行1件** で並べる。
 *
 * 札（カード）で並べると1件が縦に大きくなり、一画面に3〜6件しか入らない。
 * 読みものの一覧は「どれを読むか選ぶ」ための面なので、まず**題名が縦に並んでいる**ことが要る。
 * 日付や長さは行の右端に寄せ、題名の並びを乱さない。
 *
 * 種別の札（badge）は、複数の種類が混ざる面でだけ出す。
 * 1種類しか並ばない面で毎行に同じ札が出ても、見分けの役には立たない。
 */
export function ListRows({ items, empty = 'まだありません。' }: { items: ListRowItem[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li key={item.key}>
          <Link
            href={item.href}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1 py-3 transition-colors hover:bg-muted/60"
          >
            {item.pinned && (
              <Pin
                size={13}
                className="shrink-0 self-center"
                style={{ color: 'var(--palace)' }}
                aria-label="重要"
              />
            )}
            {item.badge && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {item.badge}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>

            <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              {item.readingMinutes != null && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />約{item.readingMinutes}分
                </span>
              )}
              {item.date && (
                <time dateTime={item.date} className="tabular-nums">
                  {new Date(item.date).toLocaleDateString('ja-JP')}
                </time>
              )}
            </span>

            {/* 要約は次の行へ落とす。題名と同じ行に詰めると題名が読みにくくなる */}
            {item.excerpt && (
              <span className="w-full truncate text-xs text-muted-foreground">{item.excerpt}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
