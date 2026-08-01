import { describe, expect, it } from 'vitest'
import { aspectRatioCss, ASPECT_RATIOS, ASPECT_RATIO_KEYS, DEFAULT_ASPECT_RATIO } from '@/lib/aspect-ratio'

describe('aspectRatioCss', () => {
  it('キーごとの比を返す', () => {
    expect(aspectRatioCss('square')).toBe('1 / 1')
    expect(aspectRatioCss('portrait')).toBe('2 / 3')
    expect(aspectRatioCss('golden')).toBe('1 / 1.618')
  })

  // 既存カードや未知の値で表示が壊れないこと
  it('未知・未設定は既定（正方形）に倒す', () => {
    expect(aspectRatioCss('bogus')).toBe(ASPECT_RATIOS[DEFAULT_ASPECT_RATIO].css)
    expect(aspectRatioCss(null)).toBe('1 / 1')
    expect(aspectRatioCss(undefined)).toBe('1 / 1')
  })

  it('すべてのキーに表示名と比がある', () => {
    for (const key of ASPECT_RATIO_KEYS) {
      expect(ASPECT_RATIOS[key].label).toBeTruthy()
      expect(ASPECT_RATIOS[key].css).toMatch(/^\d/)
    }
  })
})
