import { describe, it, expect } from 'vitest'
import {
  LIBRARY_SECTIONS,
  normalizeLibraryOrder,
  moveLibrarySection,
} from '@/lib/library-sections'

describe('normalizeLibraryOrder', () => {
  it('未設定なら既定の順', () => {
    expect(normalizeLibraryOrder(undefined)).toEqual([...LIBRARY_SECTIONS])
    expect(normalizeLibraryOrder([])).toEqual([...LIBRARY_SECTIONS])
  })

  it('指定した順を先頭に置く', () => {
    expect(normalizeLibraryOrder(['spaces', 'cards']).slice(0, 2)).toEqual(['spaces', 'cards'])
  })

  it('載っていない棚は末尾に回る（棚が画面から消えない）', () => {
    expect(normalizeLibraryOrder(['materials'])).toEqual([
      'materials',
      'cards',
      'canvas',
      'spaces',
      'boxes',
    ])
  })

  it('知らない名前は捨て、重複は畳む', () => {
    expect(normalizeLibraryOrder(['cards', 'bogus', 'cards'])).toEqual([...LIBRARY_SECTIONS])
  })

  it('全ての棚がちょうど1回ずつ現れる', () => {
    const result = normalizeLibraryOrder(['boxes', 'boxes', 'nope'])
    expect(new Set(result).size).toBe(LIBRARY_SECTIONS.length)
  })
})

describe('moveLibrarySection', () => {
  const order = [...LIBRARY_SECTIONS]

  it('1つ上へ動かす', () => {
    expect(moveLibrarySection(order, 1, -1).slice(0, 2)).toEqual(['canvas', 'cards'])
  })

  it('1つ下へ動かす', () => {
    expect(moveLibrarySection(order, 0, 1).slice(0, 2)).toEqual(['canvas', 'cards'])
  })

  it('先頭より上・末尾より下へは動かさない', () => {
    expect(moveLibrarySection(order, 0, -1)).toEqual(order)
    expect(moveLibrarySection(order, order.length - 1, 1)).toEqual(order)
  })

  it('元の配列を書き換えない', () => {
    const copy = [...order]
    moveLibrarySection(copy, 0, 1)
    expect(copy).toEqual(order)
  })
})
