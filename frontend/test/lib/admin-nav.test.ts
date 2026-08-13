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
  { key: 'overview', label: '概要', items: ['/admin'] },
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
    // 「執務室」は管理画面そのものの名前。分類として並べない
    expect(SECTIONS.map((s) => s.label)).toEqual(['概要', '分析', '運営', '戦略', 'システム'])
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
    expect(sectionOf('/admin').key).toBe('overview')
    expect(sectionOf('/admin/business').key).toBe('analytics')
    expect(sectionOf('/admin/posts/new').key).toBe('ops')
    expect(sectionOf('/admin/audit').key).toBe('system')
    expect(sectionOf('/admin/strategy').key).toBe('strategy')
  })

  it('/admin は前方一致で拾わない（すべてに当たってしまう）', () => {
    expect(sectionOf('/admin/finance').key).not.toBe('overview')
  })

  it('知らない行き先は概要に落とす（迷子にしない）', () => {
    expect(sectionOf('/admin/知らない場所').key).toBe('overview')
  })

  it('数字を見る場所に、設定を変えるものを混ぜない', () => {
    const analytics = SECTIONS.find((s) => s.key === 'analytics')!

    expect(analytics.items).not.toContain('/admin/grants')
    expect(analytics.items).not.toContain('/admin/features')
  })
})

/**
 * サイドバーに出す執務室の中身。
 *
 * **執務室は管理画面そのものの名前**で、中に分類を持つ。
 * ここに出すのは2階層まで。その先（経営 / 収支 など）は執務室の中の帯で選ぶ。
 */
const SIDEBAR_ADMIN_CHILDREN = [
  { label: '概要', href: '/admin', exact: true, children: [] as string[] },
  { label: '分析', children: ['/admin/business', '/admin/finance'] },
  {
    label: '運営',
    children: ['/admin/users', '/admin/campaigns', '/admin/rewards', '/admin/posts'],
  },
  { label: '戦略', children: ['/admin/strategy'] },
  {
    label: 'システム',
    children: ['/admin/grants', '/admin/models', '/admin/features', '/admin/audit'],
  },
]

const active = (href: string, pathname: string, exact = false) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

describe('サイドバーの執務室', () => {
  it('中身は5つで、帯の大分類と同じ並び', () => {
    expect(SIDEBAR_ADMIN_CHILDREN.map((c) => c.label)).toEqual(
      SECTIONS.map((s) => s.label)
    )
  })

  it('中の行き先が、帯の中身とそろっている', () => {
    for (const child of SIDEBAR_ADMIN_CHILDREN) {
      const section = SECTIONS.find((s) => s.label === child.label)!
      // 概要だけは中を持たない（自分がその行き先）
      const expected = child.label === '概要' ? [] : section.items
      expect(child.children, child.label).toEqual(expected)
    }
  })

  it('脇と帯で、同じ場所を別の名前で呼ばない', () => {
    const sidebar = SIDEBAR_ADMIN_CHILDREN.flatMap((c) => c.children)
    const band = SECTIONS.flatMap((s) => s.items).filter((href) => href !== '/admin')

    expect(sidebar.sort()).toEqual(band.sort())
  })

  it('概要は、ちょうど /admin のときだけ点く', () => {
    expect(active('/admin', '/admin', true)).toBe(true)
    // 前方一致のままだと、執務室の中のどのページでも点いてしまう
    expect(active('/admin', '/admin/business', true)).toBe(false)
  })

  it('分類のほうは、その中のページでも点く', () => {
    expect(active('/admin/users', '/admin/users')).toBe(true)
    expect(active('/admin/strategy', '/admin/strategy')).toBe(true)
  })
})
