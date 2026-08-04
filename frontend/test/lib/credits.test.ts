import { describe, it, expect } from 'vitest'
import { generatableCards } from '@/lib/credits'

describe('generatableCards', () => {
  it('端数は切り捨てる（半端なクレジットでは作れない）', () => {
    expect(generatableCards(9.99)).toBe(9)
    expect(generatableCards(0.97)).toBe(0)
    expect(generatableCards(1.0)).toBe(1)
  })

  it('ちょうどの枚数はそのまま', () => {
    expect(generatableCards(10)).toBe(10)
  })

  it('残高が無ければ 0', () => {
    expect(generatableCards(0)).toBe(0)
    expect(generatableCards(-1)).toBe(0)
  })

  it('数として読めない値でも 0 にする（表示が NaN にならないように）', () => {
    expect(generatableCards(Number.NaN)).toBe(0)
    expect(generatableCards(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
