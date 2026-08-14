import { describe, it, expect } from 'vitest'
import { unitPrice, discountPercent, monthlyPace, CREDIT_VALIDITY_MONTHS } from '@/lib/billing'

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

// 期限までに使い切る速さ。
// **大きい束ほど期限のほうが先に来る**ので、買う前に引き比べられる形にしておく。
describe('使い切る速さ', () => {
  it('量を期限で割った、月あたりの枚数を出す', () => {
    expect(monthlyPace(300, 3)).toBe(100)
    expect(monthlyPace(1000, 3)).toBe(334)
  })

  it('既定は画面に出している有効期間と揃える（規約と食い違わせない）', () => {
    expect(monthlyPace(300)).toBe(monthlyPace(300, CREDIT_VALIDITY_MONTHS))
  })

  it('端数は切り上げる（足りない速さを出すと使い切れない）', () => {
    expect(monthlyPace(10, 3)).toBe(4)
  })

  it('0 や負の値でも壊れない', () => {
    expect(monthlyPace(0)).toBe(0)
    expect(monthlyPace(-5)).toBe(0)
    expect(monthlyPace(100, 0)).toBe(0)
  })
})
