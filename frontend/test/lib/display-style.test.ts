import { describe, expect, it } from 'vitest'
import { DISPLAY_STYLES, DISPLAY_STYLE_KEYS, DEFAULT_DISPLAY_STYLE, isDisplayStyle } from '@/lib/display-style'

describe('display style', () => {
  it('既定は宮殿スタイル', () => {
    expect(DEFAULT_DISPLAY_STYLE).toBe('palace')
  })

  // 設定項目を増やさないための 2 択。場が増えてもここは変わらない
  it('選択肢は 2 つだけ', () => {
    expect(DISPLAY_STYLE_KEYS).toHaveLength(2)
    for (const key of DISPLAY_STYLE_KEYS) {
      expect(DISPLAY_STYLES[key].label).toBeTruthy()
      expect(DISPLAY_STYLES[key].description).toBeTruthy()
    }
  })

  it('未知の値は表示スタイルとして扱わない', () => {
    expect(isDisplayStyle('palace')).toBe(true)
    expect(isDisplayStyle('shelf')).toBe(false)
    expect(isDisplayStyle(null)).toBe(false)
  })
})
