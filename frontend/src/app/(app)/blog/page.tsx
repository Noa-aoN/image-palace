'use client'

import { useEffect, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { ListRows, type ListRowItem } from '@/components/features/posts/ListRows'
import { getPosts } from '@/lib/api/posts'
import { ARTICLES } from '@/lib/blog/articles'
import type { Post } from '@/types/post'

/**
 * コラム。読みものを1本の列に並べる。
 *
 * 出どころは2つある。
 *   1. 型付きデータで持っている記事（lib/blog/articles）
 *   2. 運営画面から書いた投稿のうち、種別が「コラム」のもの
 * 読む側にとっては同じものなので、**日付順に混ぜて1本**にする。
 * 分けて並べると「どちらを見ればよいのか」を読む側に考えさせることになる。
 */
export default function BlogPage() {
  const [columnPosts, setColumnPosts] = useState<Post[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPosts('column')
      .then((data) => {
        if (!cancelled) setColumnPosts(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const items: ListRowItem[] = [
    ...ARTICLES.map((a) => ({
      key: `article-${a.slug}`,
      href: `/blog/${a.slug}`,
      title: a.title,
      excerpt: a.excerpt,
      date: a.date,
      readingMinutes: a.readingMinutes,
      imageUrl: a.image,
    })),
    ...columnPosts.map((p) => ({
      key: `post-${p.slug}`,
      href: `/news/${p.slug}`,
      title: p.title,
      excerpt: p.excerpt,
      date: p.published_at,
      readingMinutes: p.reading_minutes,
      imageUrl: p.image_url,
    })),
  ].sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? 1 : -1))

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Newspaper size={26} style={{ color: 'var(--palace)' }} />
          コラム
        </h1>
        <p className="mt-2 text-muted-foreground">記憶・学習・認知科学にまつわる話題をお届けします。</p>
      </header>

      {/* 投稿が読めなくても、型付きの記事は出せる。全部は消さない */}
      {error && <p className="mt-6 text-sm text-muted-foreground">一部の記事を読み込めませんでした。</p>}

      <div className="mt-8">
        <ListRows items={items} />
      </div>
    </div>
  )
}
