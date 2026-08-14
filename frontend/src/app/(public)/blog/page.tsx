import type { Metadata } from 'next'
import { BlogIndex } from '@/components/features/blog/BlogIndex'
import { ARTICLES } from '@/lib/blog/articles'
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo/structured-data'

const TITLE = 'コラム'
const DESCRIPTION = '記憶・学習・認知科学にまつわる話題をお届けします。'

// 一覧そのものはサーバー側で名乗る。**中身が読み込み待ちでも、名乗りは先に返る**
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: '/blog' },
}

export default function BlogPage() {
  // 静的な定数のみ埋め込む（利用者の入力は入らないため XSS の経路にならない）
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: TITLE,
      description: DESCRIPTION,
      url: absoluteUrl('/blog'),
      inLanguage: 'ja',
      hasPart: ARTICLES.map((article) => ({
        '@type': 'Article',
        headline: article.title,
        datePublished: article.date,
        url: absoluteUrl(`/blog/${article.slug}`),
      })),
    },
    breadcrumbJsonLd([
      { name: 'ホーム', path: '/' },
      { name: TITLE, path: '/blog' },
    ]),
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogIndex />
    </>
  )
}
