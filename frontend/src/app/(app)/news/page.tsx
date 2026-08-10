'use client'

import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ListRows } from '@/components/features/posts/ListRows'
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
    <div className="mx-auto max-w-4xl px-6 py-12">
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

      {posts && posts.length > 0 && (
        <div className="mt-8">
          <ListRows
            items={posts.map((post) => ({
              key: post.slug,
              href: `/news/${post.slug}`,
              title: post.title,
              excerpt: post.excerpt,
              date: post.published_at,
              readingMinutes: post.reading_minutes,
              // 種類で絞り込めるので、「すべて」のときだけ種類を出す
              badge: category === null ? post.category_label : null,
              pinned: post.pinned,
            }))}
          />
        </div>
      )}
    </div>
  )
}
