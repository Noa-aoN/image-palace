import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { ARTICLES } from '@/lib/blog/articles'
// /sitemap.xml を生成する（Next.js メタデータ規約）。公開・インデックス対象のみ列挙する。
//
// **`(app)` の下にあるページは載せない。** あの下はログインが要るうえ、
// サーバー側では中身が描かれない（殻だけが返る）。案内した先が空では逆効果になる。
//
// 使い方ガイドと読みものは `(public)` にあり、本文が HTML で返る。
// 1件ずつ数え上げるので、**記事を足せばここに手を入れなくても載る**。

type Entry = {
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  lastModified?: string
}

const STATIC_ROUTES: Entry[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/signup', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/guide', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
  // 個々のお知らせは DB にあるので数え上げない。入口だけ知らせる
  { path: '/news', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
  // 特定商取引法の表示。売り物がある以上、探されたときに見つかる場所に置く
  { path: '/tokushoho', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
]

export function sitemapEntries(): Entry[] {
  const guides: Entry[] = GUIDE_SECTIONS.map((section) => ({
    path: `/guide/${section.slug}`,
    priority: 0.6,
    changeFrequency: 'monthly',
  }))

  const articles: Entry[] = ARTICLES.map((article) => ({
    path: `/blog/${article.slug}`,
    priority: 0.6,
    changeFrequency: 'yearly',
    lastModified: article.date,
  }))

  return [...STATIC_ROUTES, ...guides, ...articles]
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries().map(({ path, priority, changeFrequency, lastModified }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency,
    priority,
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
  }))
}
