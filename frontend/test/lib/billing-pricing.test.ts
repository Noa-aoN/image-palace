import { describe, it, expect } from 'vitest'
import { unitPrice, discountPercent } from '@/lib/billing'

// 実際に用意している買い切りの階段。値を変えたらここも直す
const TOPUPS = [
  { name: 'topup_10', price: 150, credits: 10 },
  { name: 'topup_50', price: 650, credits: 50 },
  { name: 'topup_100', price: 1200, credits: 100 },
  { name: 'topup_300', price: 3300, credits: 300 },
  { name: 'topup_1000', price: 10000, credits: 1000 },
]

describe('unitPrice', () => {
  it('1クレジットあたりの価格を返す', () => {
    expect(unitPrice({ price: 1200, credits: 100 })).toBe(12)
    expect(unitPrice({ price: 150, credits: 10 })).toBe(15)
  })

  it('付与が 0 でも壊れない（0 除算を踏まない）', () => {
    expect(unitPrice({ price: 1000, credits: 0 })).toBe(0)
  })
})

describe('discountPercent', () => {
  it('基準より安いほど割引率が上がる', () => {
    expect(discountPercent(12, 15)).toBe(20)
    expect(discountPercent(10, 15)).toBe(33)
  })

  it('割り切れる値が誤差で1つ下がらない', () => {
    // 12/15 は浮動小数点では 0.7999… になる。素の切り捨てだと 19% になってしまう
    expect(discountPercent(12, 15)).toBe(20)
    expect(discountPercent(13, 15)).toBe(13)
  })

  it('実際より多くは見せない（切り捨て）', () => {
    expect(discountPercent(11, 15)).toBe(26) // 26.67% → 26
  })

  it('基準そのもの・基準より高いものは 0（「0% お得」を出さない）', () => {
    expect(discountPercent(15, 15)).toBe(0)
    expect(discountPercent(18, 15)).toBe(0)
  })

  it('基準が無ければ 0', () => {
    expect(discountPercent(12, 0)).toBe(0)
  })
})

describe('買い切りの階段', () => {
  it('枚数が多いほど1枚あたりが安い（逆転しない）', () => {
    const rates = TOPUPS.map(unitPrice)
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeLessThan(rates[i - 1])
    }
  })

  it('いちばん安いものでも原価（1枚6円想定）を割らない', () => {
    const cheapest = Math.min(...TOPUPS.map(unitPrice))
    expect(cheapest).toBeGreaterThan(6)
  })

  it('Stripe の手数料（3.6%）を引いても原価を割らない', () => {
    const cheapestAfterFee = Math.min(...TOPUPS.map(unitPrice)) * (1 - 0.036)
    expect(cheapestAfterFee).toBeGreaterThan(6)
  })
})
