import { describe, expect, it } from 'vitest'
import { BULK_COST_THRESHOLD, balanceLabel, costLabel, creditCost } from '@/lib/billing/credit-cost'

describe('creditCost', () => {
  it('使ったあとの残りを出す', () => {
    const c = creditCost({ cost: 1, available: 4 })
    expect(c.after).toBe(3)
    expect(c.sufficient).toBe(true)
    expect(c.tone).toBe('plain')
  })

  it('足りなければ止める色にする', () => {
    const c = creditCost({ cost: 5, available: 2 })
    expect(c.sufficient).toBe(false)
    expect(c.tone).toBe('blocked')
  })

  // 残高より多く使う入力でも、残りをマイナスで見せない
  it('残りをマイナスにしない', () => {
    expect(creditCost({ cost: 9, available: 2 }).after).toBe(0)
  })

  // 読めなかっただけで作れなくなるのを避ける。本当に足りなければサーバーが断る
  it('残高が分からないときは止めない', () => {
    const c = creditCost({ cost: 3, available: null })
    expect(c.sufficient).toBe(true)
    expect(c.after).toBeNull()
    expect(c.tone).toBe('plain')
  })

  it('まとめて沢山使うときだけ強める', () => {
    expect(creditCost({ cost: BULK_COST_THRESHOLD - 1, available: 999 }).tone).toBe('plain')
    expect(creditCost({ cost: BULK_COST_THRESHOLD, available: 999 }).tone).toBe('caution')
  })

  it('足りないほうが、まとめ具合より優先される', () => {
    expect(creditCost({ cost: 50, available: 1 }).tone).toBe('blocked')
  })

  it('負の数を渡されても 0 に丸める', () => {
    expect(creditCost({ cost: -3, available: 5 }).cost).toBe(0)
  })
})

describe('言葉', () => {
  it('使う数を言う', () => {
    expect(costLabel(creditCost({ cost: 1, available: 4 }), 'cr')).toBe('この操作で 1 cr 使います')
  })

  it('無料の操作には何も言わない', () => {
    expect(costLabel(creditCost({ cost: 0, available: 4 }), 'cr')).toBeNull()
    expect(balanceLabel(creditCost({ cost: 0, available: 4 }), 'cr')).toBeNull()
  })

  it('残高の前後を並べる', () => {
    expect(balanceLabel(creditCost({ cost: 1, available: 4 }), 'cr')).toBe('残高 4 cr → 3 cr')
  })

  it('残高が分からなければ、残高の話はしない', () => {
    expect(balanceLabel(creditCost({ cost: 1, available: null }), 'cr')).toBeNull()
  })
})
