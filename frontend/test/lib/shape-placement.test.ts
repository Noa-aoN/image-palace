import { describe, expect, it } from 'vitest'
import { CLICK_SLOP, isClick, rectFromDrag, centeredAt, bandStyle } from '@/lib/shape-placement'

describe('isClick', () => {
  it('わずかな動きは押しただけとみなす（手の震えで大きさが決まらない）', () => {
    expect(isClick({ x: 100, y: 100 }, { x: 103, y: 97 })).toBe(true)
  })

  it('しきい値を超えたら引いたとみなす', () => {
    expect(isClick({ x: 100, y: 100 }, { x: 100 + CLICK_SLOP, y: 100 })).toBe(false)
  })
})

describe('rectFromDrag', () => {
  it('右下へ引いた範囲を矩形にする', () => {
    expect(rectFromDrag({ x: 10, y: 20 }, { x: 210, y: 140 }, 40)).toEqual({
      x: 10, y: 20, width: 200, height: 120,
    })
  })

  it('左上へ引いても同じ矩形になる', () => {
    expect(rectFromDrag({ x: 210, y: 140 }, { x: 10, y: 20 }, 40)).toEqual({
      x: 10, y: 20, width: 200, height: 120,
    })
  })

  // 読めない大きさのものが残ると、掴むことも消すことも難しくなる
  it('小さすぎる図形は作らない', () => {
    const rect = rectFromDrag({ x: 0, y: 0 }, { x: 12, y: 9 }, 40)
    expect(rect.width).toBe(40)
    expect(rect.height).toBe(40)
  })

  it('座標は丸める（半端な値を盤に残さない）', () => {
    expect(rectFromDrag({ x: 0.4, y: 0.6 }, { x: 100.7, y: 80.2 }, 40)).toEqual({
      x: 0, y: 1, width: 100, height: 80,
    })
  })
})

describe('centeredAt', () => {
  it('押した点が中心になる（右下へずれて出ない）', () => {
    expect(centeredAt({ x: 500, y: 300 }, 240, 160)).toEqual({ x: 380, y: 220 })
  })
})

describe('bandStyle', () => {
  it('どちらへ引いても、見えている帯は同じ', () => {
    const forward = bandStyle({ x: 10, y: 10 }, { x: 60, y: 40 })
    const backward = bandStyle({ x: 60, y: 40 }, { x: 10, y: 10 })
    expect(forward).toEqual(backward)
    expect(forward).toEqual({ left: 10, top: 10, width: 50, height: 30 })
  })
})
