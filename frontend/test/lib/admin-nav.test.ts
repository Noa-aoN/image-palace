import { describe, expect, it } from 'vitest'

/**
 * 執務室の分け方。
 *
 * **そこで何をするか**で分ける。横1列に11枚並べていたころは、
 * 見るものと変えるものが同じ列にあり、どれが危ない操作なのか読めなかった。
 *
 * ここでは、画面側と同じ表を持って、分類の決まりが崩れていないかだけを見る。
 * （画面の実装を写したものなので、片方を変えたらもう片方も直す）
 */
const SECTIONS = [
  { key: 'desk', label: '執務室', items: ['/admin'] },
  { key: 'analytics', label: '分析', items: ['/admin/business', '/admin/finance'] },
  {
    key: 'ops',
    label: '運営',
    items: ['/admin/users', '/admin/campaigns', '/admin/rewards', '/admin/posts'],
  },
  { key: 'strategy', label: '戦略', items: ['/admin/strategy'] },
  {
    key: 'system',
    label: 'システム',
    items: ['/admin/grants', '/admin/models', '/admin/features', '/admin/audit'],
  },
]

const sectionOf = (pathname: string) =>
  SECTIONS.find((section) =>
    section.items.some((href) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)))
  ) ?? SECTIONS[0]

describe('執務室の分け方', () => {
  it('大分類は5つ', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['執務室', '分析', '運営', '戦略', 'システム'])
  })

  it('同じ行き先が2つの分類に入らない', () => {
    const all = SECTIONS.flatMap((s) => s.items)

    expect(new Set(all).size).toBe(all.length)
  })

  it('既存の行き先をひとつも落としていない（URL は変えない）', () => {
    const all = SECTIONS.flatMap((s) => s.items)

    for (const href of [
      '/admin',
      '/admin/business',
      '/admin/grants',
      '/admin/campaigns',
      '/admin/models',
      '/admin/features',
      '/admin/rewards',
      '/admin/finance',
      '/admin/users',
      '/admin/posts',
      '/admin/audit',
    ]) {
      expect(all, href).toContain(href)
    }
  })

  it('いまいる場所から、その大分類が分かる', () => {
    expect(sectionOf('/admin').key).toBe('desk')
    expect(sectionOf('/admin/business').key).toBe('analytics')
    expect(sectionOf('/admin/posts/new').key).toBe('ops')
    expect(sectionOf('/admin/audit').key).toBe('system')
    expect(sectionOf('/admin/strategy').key).toBe('strategy')
  })

  it('/admin は前方一致で拾わない（すべてに当たってしまう）', () => {
    expect(sectionOf('/admin/finance').key).not.toBe('desk')
  })

  it('知らない行き先は執務室に落とす（迷子にしない）', () => {
    expect(sectionOf('/admin/知らない場所').key).toBe('desk')
  })

  it('数字を見る場所に、設定を変えるものを混ぜない', () => {
    const analytics = SECTIONS.find((s) => s.key === 'analytics')!

    expect(analytics.items).not.toContain('/admin/grants')
    expect(analytics.items).not.toContain('/admin/features')
  })
})
