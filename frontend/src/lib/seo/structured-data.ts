import { SITE_URL, SITE_NAME } from '@/lib/site'
import type { Article } from '@/lib/blog/articles'

// 検索エンジンに、そのページが何であるかを機械可読で伝える。
//
// **書いた本文と食い違わせない。** ここに書いた題名・日付・要約は、
// 画面に出しているものと同じ出どころ（`ARTICLES` / `GUIDE_SECTIONS`）から取る。

export type JsonLd = Record<string, unknown>

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '' : path}`
}

/** 読みもの1件。日付は検索結果に出るので、書いた日をそのまま渡す */
export function articleJsonLd(article: Article): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: 'ja',
    keywords: article.tags.join(', '),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/blog/${article.slug}`) },
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    ...(article.image ? { image: absoluteUrl(article.image) } : {}),
  }
}

/** 使い方の1項目。読みものではないので HowTo ではなく素の記事として出す */
export function guideJsonLd(section: { slug: string; title: string; excerpt: string }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: section.title,
    description: section.excerpt,
    inLanguage: 'ja',
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/guide/${section.slug}`) },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }
}

/** どこにいるか。検索結果に道筋が出て、1階層上へ戻れる */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  }
}
