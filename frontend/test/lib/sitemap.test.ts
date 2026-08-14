import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { sitemapEntries } from '@/app/sitemap'
import { PRIVATE_PATHS } from '@/lib/site'

// sitemap.xml は「見つけてほしいページ」の申告。
//
// **案内した先が空では、載せないより悪い。** `(app)` の下は AuthGuard が
// ログインへ送り、PageGate はサーバー側で何も描かないので、検索側から見えるのは
// 中身の無い殻になる。載せてよいのは、あの下に無いページだけ。
describe('サイトマップ', () => {
  const entries = sitemapEntries()
  const paths = entries.map((entry) => entry.path)
  const appRoot = resolve(__dirname, '../../src/app')

  /** そのパスの置き場所が `(app)` の下か（＝ログインが要り、殻しか返らないか） */
  function behindAppShell(path: string): boolean {
    const segment = path === '/' ? '' : path
    return ['page.tsx', '[slug]/page.tsx'].some((leaf) =>
      existsSync(resolve(appRoot, `(app)${segment}/${leaf}`))
    )
  }

  it('アプリの殻の中にあるページは載せない（案内した先が空になる）', () => {
    for (const path of paths) {
      expect(behindAppShell(path), `${path} は (app) の下にある`).toBe(false)
    }
  })

  it('クロールを断っているパスは載せない（申告と robots が食い違わない）', () => {
    for (const path of paths) {
      const blocked = PRIVATE_PATHS.some((priv) => path === priv || path.startsWith(`${priv}/`))
      expect(blocked, `${path} は Disallow 対象なのに載っている`).toBe(false)
    }
  })

  // 置き場所はルートグループで分かれている（`(auth)` など）。
  // グループ名は URL に出ないので、どのグループにあっても見つけられるようにする
  const ROUTE_GROUPS = ['', '(auth)']

  it('載せると決めたページは、実際にそこに置いてある', () => {
    for (const path of paths) {
      const segment = path === '/' ? '' : path
      const found = ROUTE_GROUPS.some((group) =>
        // 先頭のスラッシュを落とす（残すと絶対パスとして扱われ、app の外を見に行く）
        existsSync(resolve(appRoot, `${group}${segment}/page.tsx`.replace(/^\/+/, '')))
      )
      expect(found, `${path} のページが見当たらない`).toBe(true)
    }
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
