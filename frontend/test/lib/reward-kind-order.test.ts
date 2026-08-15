import { describe, it, expect } from 'vitest'
import { KIND_DISPLAY_ORDER, KIND_SHOWCASE_ORDER, kindRank } from '@/lib/achievements/kind-order'
import { showQuantity } from '@/lib/achievements/quantity'

describe('獲得物の並び', () => {
  it('名乗る側から持ち物側へ並ぶ（称号→勲章→表彰→宝物）', () => {
    expect(KIND_DISPLAY_ORDER).toEqual(['title', 'medal', 'honor', 'treasure'])
  })

  it('記名板は称号を別に出すので、残り3種を同じ順で並べる', () => {
    expect(KIND_SHOWCASE_ORDER).toEqual(['medal', 'honor', 'treasure'])
    expect(KIND_SHOWCASE_ORDER.every((kind) => KIND_DISPLAY_ORDER.includes(kind))).toBe(true)
  })

  it('重みは並び順のとおり', () => {
    expect(kindRank('title')).toBeLessThan(kindRank('medal'))
    expect(kindRank('medal')).toBeLessThan(kindRank('honor'))
    expect(kindRank('honor')).toBeLessThan(kindRank('treasure'))
  })

  it('知らない種別は末尾へ（増えても並びが壊れない）', () => {
    expect(kindRank('relic')).toBeGreaterThan(kindRank('treasure'))
  })
})

// **宝物は重ねて持てる。** 1個でも数を出すと、増えるものだと分かる
describe('個数を出すか', () => {
  it('持っている宝物は1個でも数を出す', () => {
    expect(showQuantity({ kind: 'treasure', quantity: 1, owned: true })).toBe(true)
  })

  it('まだ持っていない宝物には数を出さない', () => {
    expect(showQuantity({ kind: 'treasure', quantity: 0, owned: false })).toBe(false)
  })

  it('称号・勲章・表彰は1つきりなので、×1 とは書かない', () => {
    for (const kind of ['title', 'medal', 'honor']) {
      expect(showQuantity({ kind, quantity: 1, owned: true }), kind).toBe(false)
    }
  })

  it('万一2つ以上になっていれば、種別を問わず出す', () => {
    expect(showQuantity({ kind: 'medal', quantity: 2, owned: true })).toBe(true)
  })
})
