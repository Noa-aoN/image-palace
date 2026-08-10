import type { Metadata } from 'next'
import { Newspaper } from 'lucide-react'
import { ARTICLES } from '@/lib/blog/articles'
import { ListRows } from '@/components/features/posts/ListRows'

export const metadata: Metadata = { title: 'コラム' }

export default function BlogPage() {
  const articles = [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Newspaper size={26} style={{ color: 'var(--palace)' }} />
          コラム
        </h1>
        <p className="mt-2 text-muted-foreground">記憶・学習・認知科学にまつわる話題をお届けします。</p>
      </header>

      <div className="mt-8">
        <ListRows
          items={articles.map((a) => ({
            key: a.slug,
            href: `/blog/${a.slug}`,
            title: a.title,
            excerpt: a.excerpt,
            date: a.date,
            readingMinutes: a.readingMinutes,
          }))}
        />
      </div>
    </div>
  )
}
