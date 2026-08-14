import { describe, expect, it } from 'vitest'

/**
 * 作れるものの入口。
 *
 * ヘッダーの「＋」と、サイドバーの「◯◯を作成」は**同じ行き先**でなければならない。
 * 片方だけ増えると、同じ操作をしたつもりで違う結果を受け取ることになる。
 *
 * ここでは両方の表を持って、突き合わせるだけ（片方を変えたらもう片方も直す）。
 */
const HEADER_CREATE = [
  { href: '/items/new', label: 'カードを作成' },
  { href: '/views/new', label: 'キャンバスを作成' },
  { href: '/spaces/new', label: 'スペースを作成' },
  { href: '/boxes/new', label: 'ボックスを作成' },
  { href: '/materials/new', label: 'マテリアルを作成' },
]

const SIDEBAR_CREATE = [
  { href: '/items/new', label: 'カードを作成' },
  { href: '/views/new', label: 'キャンバスを作成' },
  { href: '/spaces/new', label: 'スペースを作成' },
  { href: '/boxes/new', label: 'ボックスを作成' },
  { href: '/materials/new', label: 'マテリアルを作成' },
]

describe('作れるものの入口', () => {
  it('ヘッダーと脇で、行き先も呼び名もそろっている', () => {
    expect(HEADER_CREATE).toEqual(SIDEBAR_CREATE)
  })

  it('行き先が重複しない', () => {
    const hrefs = HEADER_CREATE.map((row) => row.href)

    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('すべてページへ行く（右パネルを開く道と混ぜない）', () => {
    for (const row of HEADER_CREATE) {
      expect(row.href, row.label).toMatch(/^\/[a-z]+\/new$/)
    }
  })

  it('呼び名は「◯◯を作成」でそろえる', () => {
    for (const row of HEADER_CREATE) {
      expect(row.label, row.href).toMatch(/を作成$/)
    }
  })
})
