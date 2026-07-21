import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { ARTICLES } from '@/lib/blog/articles'

export const metadata: Metadata = { title: 'コラム' }

export default function BlogPage() {
  const articles = [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">コラム</h1>
        <p className="mt-2 text-muted-foreground">記憶・学習・認知科学にまつわる話題をお届けします。</p>
      </header>

      <ul className="mt-8 space-y-4">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/blog/${a.slug}`}
              className="block rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <time dateTime={a.date}>{new Date(a.date).toLocaleDateString('ja-JP')}</time>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  約{a.readingMinutes}分
                </span>
                {a.tags.map((t) => (
                  <span key={t} className="rounded-full border border-border px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-snug">{a.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
