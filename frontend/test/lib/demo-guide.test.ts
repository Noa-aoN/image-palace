import { describe, it, expect } from 'vitest'
import {
  DEMO_GUIDE_STEPS,
  DEMO_HOME,
  allSeen,
  demoStepForPath,
  markSeen,
} from '@/lib/demo/guide'

describe('体験の道案内', () => {
  it('最初に開くのはカード一覧（中身があるのはこちら）', () => {
    expect(DEMO_HOME).toBe('/items')
  })

  // 4つ以上あると、案内そのものが読み物になる
  it('案内は3つだけ', () => {
    expect(DEMO_GUIDE_STEPS).toHaveLength(3)
  })

  it('どの案内にも行き先と理由がある', () => {
    for (const step of DEMO_GUIDE_STEPS) {
      expect(step.href.startsWith('/')).toBe(true)
      expect(step.hint.trim()).not.toBe('')
    }
  })

  describe('いまいる場所を数える', () => {
    it('その場所そのもの', () => {
      expect(demoStepForPath('/items')).toBe('items')
      expect(demoStepForPath('/boxes')).toBe('boxes')
      expect(demoStepForPath('/views')).toBe('views')
    })

    // カードを1枚開いた人は「カード一覧を見た」に決まっている
    it('下の階層も同じ場所として数える', () => {
      expect(demoStepForPath('/items/abc-123')).toBe('items')
      expect(demoStepForPath('/views/xyz')).toBe('views')
    })

    it('関係の無い場所は数えない', () => {
      expect(demoStepForPath('/guide')).toBeNull()
      expect(demoStepForPath('/entrance')).toBeNull()
    })

    // `/itemsomething` を `/items` と数えない
    it('名前が続いているだけの場所は数えない', () => {
      expect(demoStepForPath('/itemsxyz')).toBeNull()
    })
  })

  describe('見た場所を控える', () => {
    it('足す', () => {
      expect(markSeen([], 'items')).toEqual([ 'items' ])
    })

    it('同じものは二重に持たない', () => {
      expect(markSeen([ 'items' ], 'items')).toEqual([ 'items' ])
    })

    it('数えない場所では何も起きない', () => {
      const seen = [ 'items' ]
      expect(markSeen(seen, null)).toBe(seen)
    })
  })

  describe('見終わったか', () => {
    it('3つ揃って初めて終わり', () => {
      expect(allSeen([ 'items', 'boxes' ])).toBe(false)
      expect(allSeen([ 'items', 'boxes', 'views' ])).toBe(true)
    })

    it('何も見ていなければ終わっていない', () => {
      expect(allSeen([])).toBe(false)
    })
  })
})
