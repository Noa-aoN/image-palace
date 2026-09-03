import { describe, it, expect } from 'vitest'
import { BOX_KIND, defaultBulkName } from '@/lib/items/bulk-use'

// 「新しいデッキ」だと、いくつ作っても見分けが付かない。
// 中に何が入っているかが名前から読めるほうがよい
describe('選んだカードから作るときの名前', () => {
  it('1枚なら、その名前を借りる', () => {
    expect(defaultBulkName('deck', [ 'DNS' ])).toBe('DNSのデッキ')
  })

  it('複数なら、先頭と枚数で表す', () => {
    expect(defaultBulkName('deck', [ 'DNS', 'ルーター', 'サーバー' ])).toBe('DNS ほか2枚のデッキ')
  })

  it('種別ごとに呼び名が変わる', () => {
    expect(defaultBulkName('freeboard', [ 'DNS' ])).toBe('DNSのボード')
    expect(defaultBulkName(BOX_KIND, [ 'DNS' ])).toBe('DNSのボックス')
  })

  // 空欄でも作れるようにしたいので、必ず何かを返す
  it('カードが無くても名前を返す', () => {
    expect(defaultBulkName('deck', [])).toBe('新しいデッキ')
  })

  it('名前が空白だけなら、既定へ倒す', () => {
    expect(defaultBulkName('deck', [ '   ' ])).toBe('新しいデッキ')
  })

  it('知らない種別でも落ちない', () => {
    expect(defaultBulkName('なにか', [ 'DNS' ])).toBe('DNSのキャンバス')
  })
})
