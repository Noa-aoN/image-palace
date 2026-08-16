import Link from 'next/link'
import { Clock, Pin } from 'lucide-react'

/**
 * 読みもの一覧の1行。お知らせ・使い方・コラム・公示板で共通に使う。
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
  /** 見出し画像。無ければ画像の枠ごと出さない（空の枠は「読み込み中」に見える） */
  imageUrl?: string | null
}

/**
 * 読みものを **1行1件** で並べる。
 *
 * 札（カード）を格子に並べると1件が縦に大きくなり、一画面に3〜6件しか入らない。
 * 読みものの一覧は「どれを読むか選ぶ」ための面なので、まず**題名が縦に並んでいる**ことが要る。
 *
 * ただし1行ずつでも、**1件が1件として見えている**必要がある。
 * 罫線1本で仕切っただけだと、地の色と溶けて「どこからどこまでが1件か」が分からなくなる。
 * なので1行そのものを面（枠＋下地）として置き、行の間を空ける。
 *
 * 種別の札（badge）は、複数の種類が混ざる面でだけ出す。
 * 1種類しか並ばない面で毎行に同じ札が出ても、見分けの役には立たない。
 */
export function ListRows({ items, empty = 'まだありません。' }: { items: ListRowItem[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key}>
          <Link
            href={item.href}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-[var(--palace)]/50 hover:bg-muted/50"
          >
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- 外部CDNの画像。最適化は経由させない
              <img
                src={item.imageUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
              </div>
              {item.excerpt && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.excerpt}</p>
              )}
            </div>

            {/* 日付と長さは右端へ。題名の並びを乱さない */}
            {(item.readingMinutes != null || item.date) && (
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
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
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
