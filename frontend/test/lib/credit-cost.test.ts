import { describe, expect, it } from 'vitest'
import { BULK_COST_THRESHOLD, balanceLabel, costLabel, creditCost, formatCredits } from '@/lib/billing/credit-cost'

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

describe('小数のクレジット', () => {
  // 文章のAIは 0.01cr 単位。整数に丸めると全部 0 になり、
  // 「使ったのに何も減っていない」ように見える
  it('0.01 を 0 に丸めない', () => {
    const c = creditCost({ cost: 0.01, available: 4 })
    expect(c.cost).toBe(0.01)
    expect(c.after).toBe(3.99)
    expect(costLabel(c, 'cr')).toBe('この操作で 0.01 cr 使います')
  })

  it('合計も桁が溢れない', () => {
    // 0.1 + 0.2 が 0.30000000000000004 になる類の誤差を落とす
    expect(creditCost({ cost: 0.1 + 0.2, available: 1 }).cost).toBe(0.3)
    expect(creditCost({ cost: 1.03, available: 4 }).after).toBe(2.97)
  })

  // 1 と 1.00 が別のものに見えるので、末尾の 0 は出さない
  it('末尾の 0 は書かない', () => {
    expect(formatCredits(1)).toBe('1')
    expect(formatCredits(1.0)).toBe('1')
    expect(formatCredits(0.01)).toBe('0.01')
    expect(formatCredits(1.03)).toBe('1.03')
  })

  it('残高より多い小数でも、残りをマイナスにしない', () => {
    expect(creditCost({ cost: 0.05, available: 0.01 }).after).toBe(0)
    expect(creditCost({ cost: 0.05, available: 0.01 }).sufficient).toBe(false)
  })
})
