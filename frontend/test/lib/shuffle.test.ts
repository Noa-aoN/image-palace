import { describe, it, expect } from 'vitest'
import { shuffle } from '@/lib/shuffle'

describe('shuffle', () => {
  it('元配列を変更しない（非破壊）', () => {
    const original = [1, 2, 3, 4, 5]
    const copy = [...original]
    shuffle(original)
    expect(original).toEqual(copy)
  })

  it('同じ要素を同じ個数だけ含む（順序のみ入れ替え）', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('空配列は空配列を返す', () => {
    expect(shuffle([])).toEqual([])
  })

  it('1要素はそのまま', () => {
    expect(shuffle([42])).toEqual([42])
  })
})
