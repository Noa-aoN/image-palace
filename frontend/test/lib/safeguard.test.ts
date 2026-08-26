import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LEVEL,
  MAX_LEVEL,
  clampLevel,
  safeguardImageStyle,
  safeguardLabel,
  safeguardLook,
} from '@/lib/items/safeguard'

// 「細部が読めない／構図は掴める」の境目は、絵と人と場で変わる。
// 3つの段に丸めると、ちょうどよい所が段の間に落ちる
describe('覆いの濃さ', () => {
  it('既定は、段で持っていたころの「標準」と同じ（ぼかし 24px）', () => {
    expect(safeguardLook(DEFAULT_LEVEL).blur).toBeCloseTo(24, 1)
  })

  it('目盛りを上げるほど濃くなる', () => {
    const levels = [ 0, 25, 50, 75, 100 ].map((l) => safeguardLook(l))
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i].blur).toBeGreaterThan(levels[i - 1].blur)
      expect(levels[i].wash).toBeGreaterThan(levels[i - 1].wash)
      expect(levels[i].mesh).toBeGreaterThan(levels[i - 1].mesh)
    }
  })

  // 40px を超えると何の絵かも分からなくなる。そこを上限にしている
  it('いちばん濃くても、色の気配は残る範囲に収める', () => {
    expect(safeguardLook(MAX_LEVEL).blur).toBeLessThanOrEqual(42)
  })

  // 一番薄くても、素通しにはしない
  it('いちばん薄くても、覆いは外れない', () => {
    expect(safeguardLook(0).blur).toBeGreaterThan(0)
    expect(safeguardLook(0).wash).toBeGreaterThan(0)
  })

  // 拡大は縁のぼけを枠の外へ押し出すためのもの。強くぼかすほど広く要る
  it('濃くするほど、拡大も広がる', () => {
    expect(safeguardLook(100).scale).toBeGreaterThan(safeguardLook(0).scale)
  })

  describe('範囲の外', () => {
    it('小さすぎ・大きすぎは端に丸める', () => {
      expect(clampLevel(-20)).toBe(0)
      expect(clampLevel(300)).toBe(100)
    })

    // **覆いが外れてはいけない**
    it('読めない値は既定へ倒す', () => {
      expect(clampLevel(undefined)).toBe(DEFAULT_LEVEL)
      expect(clampLevel(null)).toBe(DEFAULT_LEVEL)
      expect(clampLevel(Number.NaN)).toBe(DEFAULT_LEVEL)
    })

    it('小数は丸める', () => {
      expect(clampLevel(49.6)).toBe(50)
    })
  })

  describe('絵に当てる指定', () => {
    // Tailwind はクラス名を静的に読むので、目盛りから作った値はクラスにならない
    it('ぼかしと拡大が入る', () => {
      const style = safeguardImageStyle(50)
      expect(style.filter).toContain('blur(24.0px)')
      expect(style.transform).toContain('scale(')
    })

    it('読めない値でも、必ず何か掛かる', () => {
      expect(safeguardImageStyle(undefined).filter).toContain('blur(')
    })
  })

  // 数字だけでは、どのくらいなのかが分からない
  describe('呼び名', () => {
    it('目盛りに応じて薄い・標準・濃い', () => {
      expect(safeguardLabel(10)).toBe('薄い')
      expect(safeguardLabel(50)).toBe('標準')
      expect(safeguardLabel(90)).toBe('濃い')
    })
  })
})
