import { describe, it, expect } from 'vitest'
import { withRunningBalance } from '@/lib/billing-running-balance'

// 履歴の各行に「その時点の残高」を添える。
// **行が持っている `*_credits_after` は使えない**（古い入れ物のぶんしか無い）ので、
// いまの残高から遡って積む。
describe('その時点の残高', () => {
  it('いちばん新しい行の残高は、いまの残高', () => {
    const rows = withRunningBalance([{ credits: 10 }], 100)

    expect(rows[0].balanceAfter).toBe(100)
  })

  it('遡るほど、その後の増減を打ち消した額になる', () => {
    const rows = withRunningBalance([{ credits: 10 }, { credits: -3 }, { credits: 50 }], 100)

    expect(rows.map((r) => r.balanceAfter)).toEqual([100, 90, 93])
  })

  it('減った行も正しく遡れる', () => {
    const rows = withRunningBalance([{ credits: -110 }], 398)

    expect(rows[0].balanceAfter).toBe(398)
  })

  it('元の中身は保つ', () => {
    const rows = withRunningBalance([{ credits: 10, label: 'x' } as never], 100)

    expect(rows[0]).toMatchObject({ credits: 10, label: 'x', balanceAfter: 100 })
  })

  it('行が無ければ空を返す', () => {
    expect(withRunningBalance([], 100)).toEqual([])
  })

  it('残高が0でも壊れない', () => {
    expect(withRunningBalance([{ credits: -5 }], 0).map((r) => r.balanceAfter)).toEqual([0])
  })
})
