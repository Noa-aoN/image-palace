import { describe, it, expect } from 'vitest'
import { articleJsonLd, guideJsonLd, breadcrumbJsonLd, absoluteUrl } from '@/lib/seo/structured-data'
import { ARTICLES } from '@/lib/blog/articles'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { SITE_URL } from '@/lib/site'

// 検索エンジンに渡す申告。**画面に出しているものと食い違わせない。**
describe('構造化データ', () => {
  it('URL は絶対で、ドメインは1つだけ（重複ページを作らない）', () => {
    expect(absoluteUrl('/blog/x')).toBe(`${SITE_URL}/blog/x`)
    expect(absoluteUrl('/')).toBe(SITE_URL)
  })

  describe('読みもの', () => {
    const article = ARTICLES[0]
    const data = articleJsonLd(article)

    it('題名・要約・書いた日を、本文と同じ出どころから取る', () => {
      expect(data.headline).toBe(article.title)
      expect(data.description).toBe(article.excerpt)
      expect(data.datePublished).toBe(article.date)
    })

    it('どのページの話かを、絶対URLで指す', () => {
      expect(data.mainEntityOfPage).toEqual({
        '@type': 'WebPage',
        '@id': `${SITE_URL}/blog/${article.slug}`,
      })
    })

    it('見出し画像を持たない記事には、画像の欄を作らない（空を渡さない）', () => {
      expect(articleJsonLd({ ...article, image: undefined })).not.toHaveProperty('image')
    })

    it('見出し画像があれば絶対URLにする', () => {
      const data = articleJsonLd({ ...article, image: '/lp/a.webp' })

      expect(data.image).toBe(`${SITE_URL}/lp/a.webp`)
    })

    it('全ての記事で作れる（1件でも欠けると検索結果が崩れる）', () => {
      for (const each of ARTICLES) {
        expect(articleJsonLd(each).headline).toBeTruthy()
      }
    })
  })

  it('使い方は、読みものではなく手引きとして出す', () => {
    const data = guideJsonLd(GUIDE_SECTIONS[0])

    expect(data['@type']).toBe('TechArticle')
    expect(data.headline).toBe(GUIDE_SECTIONS[0].title)
  })

  describe('道筋', () => {
    const data = breadcrumbJsonLd([
      { name: 'ホーム', path: '/' },
      { name: 'コラム', path: '/blog' },
    ])

    it('1から順に番号が振られる', () => {
      const items = data.itemListElement as { position: number; item: string }[]

      expect(items.map((i) => i.position)).toEqual([1, 2])
      expect(items[0].item).toBe(SITE_URL)
    })
  })
})
