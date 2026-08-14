import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'
import { ARTICLES, getArticle, type ArticleBlock } from '@/lib/blog/articles'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/structured-data'

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: 'コラム' }

  return {
    title: article.title,
    description: article.excerpt,
    // 同じ記事が別の URL でも読める形にしない（検索から見て重複になる）
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.excerpt,
      url: `/blog/${article.slug}`,
      publishedTime: article.date,
      tags: article.tags,
    },
  }
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="mt-8 text-xl font-semibold">{block.text}</h2>
    case 'p':
      return <p className="mt-4 leading-relaxed text-foreground/90">{block.text}</p>
    case 'ul':
      return (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 leading-relaxed text-foreground/90">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )
    case 'quote':
      return (
        <blockquote
          className="mt-6 border-l-4 pl-4 text-lg italic text-muted-foreground"
          style={{ borderColor: 'var(--palace)' }}
        >
          {block.text}
        </blockquote>
      )
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  // 静的な定数のみ埋め込む（利用者の入力は入らないため XSS の経路にならない）
  const jsonLd = [
    articleJsonLd(article),
    breadcrumbJsonLd([
      { name: 'ホーム', path: '/' },
      { name: 'コラム', path: '/blog' },
      { name: article.title, path: `/blog/${article.slug}` },
    ]),
  ]

  return (
    <article className="mx-auto max-w-7xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 外枠は全幅、本文は読みやすい幅に制限 */}
      <div className="mx-auto max-w-2xl">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={14} />
        コラム一覧へ
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <time dateTime={article.date}>{new Date(article.date).toLocaleDateString('ja-JP')}</time>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            約{article.readingMinutes}分
          </span>
          {article.tags.map((t) => (
            <span key={t} className="rounded-full border border-border px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
        <h1 className="mt-3 text-2xl font-semibold leading-snug">{article.title}</h1>
      </header>

      <div className="mt-6">
        {article.body.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      {article.references && article.references.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">参考文献</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {article.references.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </article>
  )
}
