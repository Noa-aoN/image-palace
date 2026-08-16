'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronRight, Megaphone, Newspaper, Pin } from 'lucide-react'
import { ListRows } from '@/components/features/posts/ListRows'
import { getPosts } from '@/lib/api/posts'
import { ARTICLES } from '@/lib/blog/articles'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { NEWS_CATEGORIES, type Post } from '@/types/post'

/** 各欄に出す件数。ここを増やすと「一望」ではなく一覧になる */
const PREVIEW = 5

/**
 * 公示板。運営から届くもの（お知らせ・使い方・コラム）を一望する面。
 *
 * 3つを縦に積むと、下の2つは畳まれた扉と変わらない（誰も下までは見ない）。
 * 横に並べて、**それぞれの最新数件が同時に目に入る**ようにする。公示板の板と同じ形。
 *
 * 重要なお知らせだけは、欄の中に埋めず上に一段抜き出す。
 * 障害や仕様変更は「探しに来た人」ではなく「たまたま来た人」に届く必要がある。
 */
export default function BoardPage() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPosts()
      .then((data) => {
        if (!cancelled) setPosts(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // お知らせ欄には連絡（お知らせ・更新情報）だけを出す。コラムはコラム欄へ回す
  const news = posts?.filter((p) => NEWS_CATEGORIES.includes(p.category)) ?? []
  const pinned = news.filter((p) => p.pinned)
  const rest = news.filter((p) => !p.pinned)
  const columns = [
    ...ARTICLES.map((a) => ({
      key: `article-${a.slug}`, href: `/blog/${a.slug}`, title: a.title,
      date: a.date as string | null, readingMinutes: a.readingMinutes as number | null,
    })),
    ...(posts ?? [])
      .filter((p) => p.category === 'column')
      .map((p) => ({
        key: `post-${p.slug}`, href: `/news/${p.slug}`, title: p.title,
        date: p.published_at, readingMinutes: p.reading_minutes, imageUrl: p.image_url,
      })),
  ].sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? 1 : -1))

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Megaphone size={26} style={{ color: 'var(--palace)' }} />
          公示板
        </h1>
        <p className="mt-2 text-muted-foreground">運営からのお知らせ・使い方・コラムをまとめています。</p>
      </header>

      {pinned.length > 0 && (
        <div className="mt-6 rounded-xl border border-[var(--palace)]/40 bg-[var(--palace)]/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--palace)' }}>
            <Pin size={13} />
            重要なお知らせ
          </p>
          <ul className="mt-2 space-y-1.5">
            {pinned.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/news/${p.slug}`}
                  className="flex items-baseline gap-3 text-sm font-medium hover:underline"
                >
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {p.published_at && (
                    <time dateTime={p.published_at} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(p.published_at).toLocaleDateString('ja-JP')}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <Column href="/news" icon={<Megaphone size={18} />} title="お知らせ" note="更新情報・運営からの連絡">
          {error ? (
            <p className="py-6 text-sm text-destructive">読み込めませんでした。</p>
          ) : posts === null ? (
            <p className="py-6 text-sm text-muted-foreground">読み込み中…</p>
          ) : (
            <ListRows
              empty="まだお知らせはありません。"
              items={rest.slice(0, PREVIEW).map((p) => ({
                key: p.slug,
                href: `/news/${p.slug}`,
                title: p.title,
                date: p.published_at,
                badge: p.category_label,
                imageUrl: p.image_url,
              }))}
            />
          )}
        </Column>

        <Column href="/guide" icon={<BookOpen size={18} />} title="使い方" note="はじめ方・機能・用語">
          <ListRows
            items={GUIDE_SECTIONS.slice(0, PREVIEW).map((s) => ({
              key: s.slug,
              href: `/guide/${s.slug}`,
              title: s.title,
            }))}
          />
        </Column>

        <Column href="/blog" icon={<Newspaper size={18} />} title="コラム" note="記憶・学習にまつわる読みもの">
          <ListRows
            items={columns.slice(0, PREVIEW)}
          />
        </Column>
      </div>
    </div>
  )
}

function Column({
  href,
  icon,
  title,
  note,
  children,
}: {
  href: string
  icon: React.ReactNode
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <span style={{ color: 'var(--palace)' }}>{icon}</span>
          {title}
        </h2>
        <Link href={href} className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:underline">
          すべて見る
          <ChevronRight size={13} />
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      <div className="mt-3">{children}</div>
    </section>
  )
}
