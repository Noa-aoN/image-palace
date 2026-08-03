import { describe, it, expect } from 'vitest'
import { isNavItemActive } from '@/lib/nav-active'

describe('isNavItemActive', () => {
  it('同じパスなら選択中', () => {
    expect(isNavItemActive('/views', '/views', '')).toBe(true)
  })

  it('配下のページを開いていても親は選択中', () => {
    expect(isNavItemActive('/views', '/views/abc', '')).toBe(true)
  })

  it('別のパスなら選択中ではない', () => {
    expect(isNavItemActive('/views', '/items', '')).toBe(false)
  })

  it('/views を見ている間はデッキ一覧を選択中にしない', () => {
    expect(isNavItemActive('/views?type=deck', '/views', '')).toBe(false)
  })

  it('デッキ一覧を見ている間は、デッキ一覧だけが選択中になる', () => {
    expect(isNavItemActive('/views?type=deck', '/views', 'type=deck')).toBe(true)
    expect(isNavItemActive('/views', '/views', 'type=deck')).toBe(false)
  })

  it('別の絞り込みを見ている間は選択中にしない', () => {
    expect(isNavItemActive('/views?type=deck', '/views', 'type=freeboard')).toBe(false)
  })

  it('絞り込みがまだ読めていない間は、絞り込み付きの項目を光らせない', () => {
    expect(isNavItemActive('/views?type=deck', '/views', null)).toBe(false)
    expect(isNavItemActive('/views', '/views', null)).toBe(true)
  })

  it('似た名前のパスを取り違えない', () => {
    expect(isNavItemActive('/items', '/itemsx', '')).toBe(false)
  })
})
