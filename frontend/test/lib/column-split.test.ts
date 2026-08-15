import { describe, it, expect } from 'vitest'
import { splitIntoColumns, evenColumnCounts } from '@/lib/items/column-split'

// 自分で列ごとの個数を決めたときの振り分け。
// **札が消えない**ことが要（数を書き換えている最中は、合計が合わない）。
describe('列への振り分け', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']

  it('上から順に、決めた数だけ左の列から詰める', () => {
    expect(splitIntoColumns(items, [1, 6, 2], 3)).toEqual([
      ['a'],
      ['b', 'c', 'd', 'e', 'f', 'g'],
      ['h', 'i'],
    ])
  })

  it('合計が足りなければ、余りは最後の列へ回す（札が消えない）', () => {
    const result = splitIntoColumns(items, [1, 1, 1], 3)

    expect(result.flat()).toEqual(items)
    expect(result[2]).toEqual(['c', 'd', 'e', 'f', 'g', 'h', 'i'])
  })

  it('合計が多すぎても、無い札は作らない', () => {
    const result = splitIntoColumns(['a', 'b'], [5, 5, 5], 3)

    expect(result.flat()).toEqual(['a', 'b'])
    expect(result[1]).toEqual([])
  })

  it('空の列を作れる（左を空けて右に寄せる、ができる）', () => {
    expect(splitIntoColumns(['a', 'b'], [0, 2], 2)).toEqual([[], ['a', 'b']])
  })

  it('数を決めていない列は空として扱い、余りは最後へ', () => {
    expect(splitIntoColumns(items, [2], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd', 'e', 'f', 'g', 'h', 'i'],
    ])
  })

  it('負の数・端数でも壊れない', () => {
    const result = splitIntoColumns(items, [-3, 2.7], 2)

    expect(result.flat()).toEqual(items)
    expect(result[0]).toEqual([])
  })

  it('列が1つなら全部そこへ', () => {
    expect(splitIntoColumns(items, [3], 1)).toEqual([items])
  })

  it('札が無ければ、空の列が並ぶだけ', () => {
    expect(splitIntoColumns([], [1, 2], 2)).toEqual([[], []])
  })
})

describe('はじめの数', () => {
  it('なるべく均す（端数は左の列から）', () => {
    expect(evenColumnCounts(7, 3)).toEqual([3, 2, 2])
    expect(evenColumnCounts(6, 3)).toEqual([2, 2, 2])
    expect(evenColumnCounts(2, 3)).toEqual([1, 1, 0])
  })

  it('合計は札の数と一致する', () => {
    for (const total of [0, 1, 5, 9, 20]) {
      expect(evenColumnCounts(total, 3).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
})
