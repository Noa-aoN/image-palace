'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPosts } from '@/lib/api/posts'
import { POST_CATEGORIES, POST_CATEGORY_LABELS, type Post, type PostCategory } from '@/types/post'

/**
 * 運営からの読みもの（お知らせ・更新情報・コラム）。
 *
 * 中身は運営画面から書ける。ここは読む側なので、公開済みのものだけが並ぶ。
 */
export default function NewsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [category, setCategory] = useState<PostCategory | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPosts(category ?? undefined)
      .then((data) => {
        if (!cancelled) setPosts(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [category])

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Megaphone size={26} style={{ color: 'var(--palace)' }} />
          お知らせ
        </h1>
        <p className="mt-2 text-muted-foreground">運営からのお知らせ・更新情報・読みものです。</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant={category === null ? 'default' : 'outline'} onClick={() => setCategory(null)}>
          すべて
        </Button>
        {POST_CATEGORIES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? 'default' : 'outline'}
            onClick={() => setCategory(c)}
          >
            {POST_CATEGORY_LABELS[c]}
          </Button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-destructive">読み込めませんでした。</p>}

      {posts === null && !error && <p className="mt-8 text-sm text-muted-foreground">読み込み中…</p>}

      {posts?.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">まだ投稿はありません。</p>
      )}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts?.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/news/${post.slug}`}
              className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">{post.category_label}</span>
                {post.published_at && (
                  <time dateTime={post.published_at}>
                    {new Date(post.published_at).toLocaleDateString('ja-JP')}
                  </time>
                )}
                {post.reading_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />約{post.reading_minutes}分
                  </span>
                )}
                {post.pinned && <span className="text-[var(--palace)]">重要</span>}
              </div>
              <h2 className="mt-2 font-semibold">{post.title}</h2>
              {post.excerpt && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
