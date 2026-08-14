import { describe, it, expect } from 'vitest'
import { sitemapEntries } from '@/app/sitemap'
import { PRIVATE_PATHS } from '@/lib/site'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { ARTICLES } from '@/lib/blog/articles'

// sitemap.xml は「見つけてほしいページ」の申告。
// **載せ忘れたページは、書いても見つからない。**
describe('サイトマップ', () => {
  const entries = sitemapEntries()
  const paths = entries.map((entry) => entry.path)

  it('書いた読みものを1件残らず載せる（記事を足したら自動で載る）', () => {
    for (const article of ARTICLES) {
      expect(paths).toContain(`/blog/${article.slug}`)
    }
  })

  it('使い方ガイドを1件残らず載せる', () => {
    for (const section of GUIDE_SECTIONS) {
      expect(paths).toContain(`/guide/${section.slug}`)
    }
  })

  it('クロールを断っているパスは載せない（申告と robots が食い違わない）', () => {
    for (const path of paths) {
      const blocked = PRIVATE_PATHS.some((priv) => path === priv || path.startsWith(`${priv}/`))
      expect(blocked, `${path} は Disallow 対象なのに載っている`).toBe(false)
    }
  })

  it('同じページを二度載せない', () => {
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('重みは 0〜1 に収まる', () => {
    for (const entry of entries) {
      expect(entry.priority).toBeGreaterThan(0)
      expect(entry.priority).toBeLessThanOrEqual(1)
    }
  })

  it('読みものには書いた日を添える（更新の頻度が伝わる）', () => {
    const article = entries.find((entry) => entry.path === `/blog/${ARTICLES[0].slug}`)

    expect(article?.lastModified).toBe(ARTICLES[0].date)
  })
})
