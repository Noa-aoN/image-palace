import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { sitemapEntries } from '@/app/sitemap'
import { PRIVATE_PATHS } from '@/lib/site'
import { GUIDE_SECTIONS } from '@/lib/guide/sections'
import { ARTICLES } from '@/lib/blog/articles'

// sitemap.xml は「見つけてほしいページ」の申告。
//
// **案内した先が空では、載せないより悪い。** `(app)` の下は AuthGuard が
// ログインへ送り、PageGate はサーバー側で何も描かないので、検索側から見えるのは
// 中身の無い殻になる。載せてよいのは、あの下に無いページだけ。
describe('サイトマップ', () => {
  const entries = sitemapEntries()
  const paths = entries.map((entry) => entry.path)
  const appRoot = resolve(__dirname, '../../src/app')

  // 置き場所はルートグループで分かれている。グループ名は URL に出ないので、
  // どのグループにあっても見つけられるようにする
  const ROUTE_GROUPS = ['', '(auth)', '(public)']

  /** そのパスを描くファイル。決め打ちのページか、`[slug]` のどちらか */
  function pageFileIn(group: string, path: string): string | null {
    const segment = path === '/' ? '' : path
    // 先頭のスラッシュを落とす（残すと絶対パスとして扱われ、app の外を見に行く）
    const own = `${group}${segment}/page.tsx`.replace(/^\/+/, '')
    if (existsSync(resolve(appRoot, own))) return own

    const parent = segment.slice(0, segment.lastIndexOf('/'))
    const bySlug = `${group}${parent}/[slug]/page.tsx`.replace(/^\/+/, '')
    return existsSync(resolve(appRoot, bySlug)) ? bySlug : null
  }

  function pageFileFor(path: string): string | null {
    for (const group of ROUTE_GROUPS) {
      const found = pageFileIn(group, path)
      if (found) return found
    }
    return null
  }

  it('載せると決めたページは、実際にそこに置いてある', () => {
    for (const path of paths) {
      expect(pageFileFor(path), `${path} のページが見当たらない`).not.toBeNull()
    }
  })

  it('アプリの殻の中にあるページは載せない（案内した先が空になる）', () => {
    for (const path of paths) {
      expect(pageFileIn('(app)', path), `${path} は (app) の下にある`).toBeNull()
    }
  })

  it('クロールを断っているパスは載せない（申告と robots が食い違わない）', () => {
    for (const path of paths) {
      const blocked = PRIVATE_PATHS.some((priv) => path === priv || path.startsWith(`${priv}/`))
      expect(blocked, `${path} は Disallow 対象なのに載っている`).toBe(false)
    }
  })

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

  it('読みものには書いた日を添える（更新の頻度が伝わる）', () => {
    const article = entries.find((entry) => entry.path === `/blog/${ARTICLES[0].slug}`)

    expect(article?.lastModified).toBe(ARTICLES[0].date)
  })

  it('売り物がある以上、特定商取引法の表示は見つかる場所に置く', () => {
    expect(paths).toContain('/tokushoho')
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
})
