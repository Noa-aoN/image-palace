import { describe, expect, it } from 'vitest'
import { deltaRate, isUnmeasured } from '@/lib/metrics'

describe('deltaRate', () => {
  it('増えたときは up=true で率を返す', () => {
    expect(deltaRate(150, 100)).toEqual({ rate: 50, up: true })
  })

  it('減ったときは up=false', () => {
    expect(deltaRate(75, 100)).toEqual({ rate: -25, up: false })
  })

  it('横ばいは 0% で増加側に寄せる', () => {
    expect(deltaRate(100, 100)).toEqual({ rate: 0, up: true })
  })

  it('小数第1位まで丸める', () => {
    expect(deltaRate(101, 300)).toEqual({ rate: -66.3, up: false })
  })

  // 0 → 1 を「+100%」と書くと、1 → 2 と同じ見た目になってしまう。
  // 母数が無いことは、増減が無いこととは違う。
  it('前の期間が 0 なら率を出さない', () => {
    expect(deltaRate(5, 0)).toBeNull()
    expect(deltaRate(0, 0)).toBeNull()
  })

  it('両方が 0 でなければ、現在が 0 でも出す（-100%）', () => {
    expect(deltaRate(0, 40)).toEqual({ rate: -100, up: false })
  })
})

describe('isUnmeasured', () => {
  it('null と undefined は未計測', () => {
    expect(isUnmeasured(null)).toBe(true)
    expect(isUnmeasured(undefined)).toBe(true)
  })

  it('0 は未計測ではない（測って 0 だった）', () => {
    expect(isUnmeasured(0)).toBe(false)
  })
})
