import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
// /sitemap.xml を生成する（Next.js メタデータ規約）。公開・インデックス対象のみ列挙する。
//
// **`(app)` の下にあるページは載せない。** あの下はログインが要るうえ、
// サーバー側では中身が描かれない（殻だけが返る）。案内した先が空では逆効果になる。
// 使い方ガイドと読みものを載せたい場合は、置き場所のほうを先に動かすこと。

type Entry = {
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  lastModified?: string
}

const STATIC_ROUTES: Entry[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/signup', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
  // 特定商取引法の表示。売り物がある以上、探されたときに見つかる場所に置く
  { path: '/tokushoho', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
]

export function sitemapEntries(): Entry[] {
  return [...STATIC_ROUTES]
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries().map(({ path, priority, changeFrequency, lastModified }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency,
    priority,
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
  }))
}
