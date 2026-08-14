'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getPost } from '@/lib/api/posts'
import type { Post, PostBlock } from '@/types/post'

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPost(slug)
      .then((data) => {
        if (!cancelled) setPost(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={15} />
        お知らせ一覧
      </Link>

      {error && <p className="mt-8 text-sm text-destructive">見つかりませんでした。</p>}
      {!post && !error && <p className="mt-8 text-sm text-muted-foreground">読み込み中…</p>}

      {post && (
        <>
          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5">{post.category_label}</span>
              {post.published_at && (
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString('ja-JP')}
                </time>
              )}
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-2xl font-semibold">{post.title}</h1>
            {post.excerpt && <p className="mt-3 text-muted-foreground">{post.excerpt}</p>}

            {/* 見出し画像。無ければ枠ごと出さない（空の枠は「読み込み中」に見える） */}
            {post.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- 外部CDNの画像。最適化は経由させない
              <img
                src={post.image_url}
                alt=""
                className="mt-5 w-full rounded-xl border border-border object-cover"
              />
            )}
          </header>

          <div className="mt-8 space-y-4">
            {(post.body ?? []).map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        </>
      )}
    </article>
  )
}

function Block({ block }: { block: PostBlock }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="mt-8 text-lg font-semibold">{block.text}</h2>
    case 'ul':
      return (
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )
    case 'quote':
      return (
        <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
          {block.text}
        </blockquote>
      )
    default:
      return <p className="leading-relaxed">{block.text}</p>
  }
}
