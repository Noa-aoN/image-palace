import { describe, it, expect } from 'vitest'
import { PROPERTY_COLORS, propertyColorOf } from '@/lib/api/properties'

// 項目ごとの目印の色。**見出しの前に置く小さな丸**。
//
// サーバーは色の名前だけを持ち、実際の色味はこちらが決める。
// 生の値を保存していると、地に載る色味を調整するたびに保存済みの行を書き換えることになる。
describe('項目ごとの色', () => {
  it('決めた色は、丸の色が引ける', () => {
    expect(propertyColorOf('purple')).toEqual({ key: 'purple', label: '藤', hex: '#9a6dd7' })
  })

  // **付けた人が付けたものだけが目立つ**状態を既定にする
  it('付けていなければ丸を出さない', () => {
    expect(propertyColorOf(null)).toBeNull()
    expect(propertyColorOf(undefined)).toBeNull()
    expect(propertyColorOf('')).toBeNull()
  })

  // 対応表に無い色が届くのは、こちらが古いとき。
  // 空の丸や黒い丸が出ると、付けていない項目より目立ってしまう
  it('知らない色は出さない', () => {
    expect(propertyColorOf('たまご色')).toBeNull()
  })

  it('名前は重複しない', () => {
    const keys = PROPERTY_COLORS.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  // 金だけは札の色（--palace）を使い回す。ここで別の金を作ると2種類になる
  it('金は既にある札の色を使う', () => {
    expect(propertyColorOf('gold')?.hex).toBe('var(--palace)')
  })

  // **サーバーと同じ並びを持つ。** 片方だけ足すと、
  // 選べるのに保存できない色（またはその逆）ができる。
  // backend の spec/models/property_color_spec.rb が同じ一覧を固定している
  it('サーバーが受け付ける色と一致する', () => {
    expect(PROPERTY_COLORS.map((c) => c.key)).toEqual([
      'gold', 'purple', 'blue', 'green', 'red', 'orange', 'pink', 'gray',
    ])
  })

  it('どの色にも呼び名がある', () => {
    expect(PROPERTY_COLORS.every((c) => c.label.trim() !== '')).toBe(true)
  })
})
