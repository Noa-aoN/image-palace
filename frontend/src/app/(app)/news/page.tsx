'use client'

import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ListRows } from '@/components/features/posts/ListRows'
import { getPosts } from '@/lib/api/posts'
import { NEWS_CATEGORIES, POST_CATEGORY_LABELS, type Post, type PostCategory } from '@/types/post'

/**
 * お知らせ。**運営からの連絡**（お知らせ・更新情報）だけを並べる。
 *
 * 投稿には「コラム」の種別もあるが、それはここではなく /blog に出す。
 * 読みたい理由が違うものを同じ面に混ぜると、
 * 障害や仕様変更の連絡が読みものに埋もれて届かなくなる。
 *
 * 中身は運営画面から書ける。ここは読む側なので、公開済みのものだけが並ぶ。
 */
export default function NewsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [category, setCategory] = useState<PostCategory | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPosts()
      .then((data) => {
        if (!cancelled) setPosts(data.filter((p) => NEWS_CATEGORIES.includes(p.category)))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shown = posts?.filter((p) => category === null || p.category === category) ?? null

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Megaphone size={26} style={{ color: 'var(--palace)' }} />
          お知らせ
        </h1>
        <p className="mt-2 text-muted-foreground">運営からのお知らせ・更新情報です。</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant={category === null ? 'default' : 'outline'} onClick={() => setCategory(null)}>
          すべて
        </Button>
        {NEWS_CATEGORIES.map((c) => (
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

      {shown === null && !error && <p className="mt-8 text-sm text-muted-foreground">読み込み中…</p>}

      {shown !== null && (
        <div className="mt-8">
          <ListRows
            empty="まだお知らせはありません。"
            items={shown.map((post) => ({
              key: post.slug,
              href: `/news/${post.slug}`,
              title: post.title,
              excerpt: post.excerpt,
              date: post.published_at,
              readingMinutes: post.reading_minutes,
              // 種類で絞り込めるので、「すべて」のときだけ種類を出す
              badge: category === null ? post.category_label : null,
              pinned: post.pinned,
              imageUrl: post.image_url,
            }))}
          />
        </div>
      )}
    </div>
  )
}
