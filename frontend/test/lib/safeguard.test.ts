import { describe, it, expect } from 'vitest'
import { safeguardLook, safeguardImageClass, SAFEGUARD_STRENGTHS } from '@/lib/items/safeguard'

// 覆いの濃さ。「細部が読めない／構図は掴める」の境目は人によって違う
describe('覆いの濃さ', () => {
  it('標準は従来の見え方（24px）', () => {
    expect(safeguardLook('normal').image).toContain('blur-[24px]')
  })

  it('薄いほうが弱く、濃いほうが強い', () => {
    const px = (s: string) => Number(safeguardLook(s).image.match(/blur-\[(\d+)px\]/)![1])
    expect(px('light')).toBeLessThan(px('normal'))
    expect(px('normal')).toBeLessThan(px('strong'))
  })

  // 霞も一緒に上げる。ぼかしだけ強くしても、直視の圧は下がらない
  it('濃いほど霞も濃くなる', () => {
    expect(safeguardLook('light').wash).toBeLessThan(safeguardLook('normal').wash)
    expect(safeguardLook('normal').wash).toBeLessThan(safeguardLook('strong').wash)
  })

  // **覆いが外れてはいけない。** サーバーが先に進んでいても、必ず何か掛かる
  it('知らない値は標準に倒す', () => {
    expect(safeguardLook('とても濃い')).toEqual(safeguardLook('normal'))
    expect(safeguardLook(null)).toEqual(safeguardLook('normal'))
    expect(safeguardLook(undefined)).toEqual(safeguardLook('normal'))
  })

  // 引きずるとブラウザが元の画像を持ち上げる。どの濃さでも止める
  it('どの濃さでも、掴めなくする指定が入る', () => {
    for (const s of SAFEGUARD_STRENGTHS) {
      expect(safeguardImageClass(s.key)).toContain('select-none')
      expect(safeguardImageClass(s.key)).toContain('[-webkit-user-drag:none]')
    }
  })

  it('選べる濃さは3つ', () => {
    expect(SAFEGUARD_STRENGTHS.map((s) => s.key)).toEqual(['light', 'normal', 'strong'])
  })
})
