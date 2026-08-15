import { describe, expect, it } from 'vitest'
import { daysUntilExpiry, expiresSoon, expiryUrgencyLabel } from '@/lib/billing'

const now = new Date('2026-08-16T23:30:00+09:00')

describe('daysUntilExpiry', () => {
  it('期限なしは数えない', () => {
    expect(daysUntilExpiry(null, now)).toBeNull()
    expect(daysUntilExpiry(undefined, now)).toBeNull()
  })

  it('壊れた日付でも落ちない', () => {
    expect(daysUntilExpiry('いつか', now)).toBeNull()
  })

  // 時刻まで数えると、同じ「明日まで」が朝と夜で 0 日と 1 日に割れる
  it('夜に見ても、日付だけで数える', () => {
    expect(daysUntilExpiry('2026-08-17T09:00:00+09:00', now)).toBe(1)
    expect(daysUntilExpiry('2026-08-16T09:00:00+09:00', now)).toBe(0)
  })

  it('過ぎたものは負の数', () => {
    expect(daysUntilExpiry('2026-08-14T09:00:00+09:00', now)).toBe(-2)
  })
})

describe('expiresSoon', () => {
  it('14日以内なら近い', () => {
    expect(expiresSoon('2026-08-30T09:00:00+09:00', now)).toBe(true)
  })

  it('15日先はまだ急がない', () => {
    expect(expiresSoon('2026-08-31T09:00:00+09:00', now)).toBe(false)
  })

  it('期限なしは急がない', () => {
    expect(expiresSoon(null, now)).toBe(false)
  })
})

describe('expiryUrgencyLabel', () => {
  it('遠いものには何も添えない', () => {
    expect(expiryUrgencyLabel('2026-12-01T09:00:00+09:00', now)).toBeNull()
  })

  it('近いものには残り日数を添える', () => {
    expect(expiryUrgencyLabel('2026-08-19T09:00:00+09:00', now)).toBe('あと3日')
    expect(expiryUrgencyLabel('2026-08-16T09:00:00+09:00', now)).toBe('今日まで')
    expect(expiryUrgencyLabel('2026-08-14T09:00:00+09:00', now)).toBe('期限切れ')
  })
})
