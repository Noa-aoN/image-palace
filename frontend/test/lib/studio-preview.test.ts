import { describe, it, expect } from 'vitest'
import { previewEntryPath, showsPreviewBanner } from '@/lib/studio/preview'
import type { PreviewState } from '@/lib/api/studio'

function preview(over: Partial<Extract<PreviewState, { active: true }>> = {}): PreviewState {
  return {
    active: true,
    key: 'starter_it',
    version: 3,
    name: 'ITのことば',
    box_id: null,
    view_id: null,
    items: 12,
    expires_at: '2026-08-22T00:00:00Z',
    ...over,
  }
}

// **受け取った人が最初に見る場所と同じにする。**
// 下見の値打ちは「同じ見え方を確かめられる」ことなので、入口がずれると意味が薄れる
describe('下見で開く先', () => {
  it('箱があれば、箱を開く', () => {
    expect(previewEntryPath(preview({ box_id: 'b1' }))).toBe('/boxes/b1')
  })

  it('箱が無ければ、キャンバスを開く', () => {
    expect(previewEntryPath(preview({ view_id: 'v1' }))).toBe('/views/v1')
  })

  it('箱もキャンバスもあれば、箱を先に開く', () => {
    expect(previewEntryPath(preview({ box_id: 'b1', view_id: 'v1' }))).toBe('/boxes/b1')
  })

  // 何も起きないより、少なくとも宮殿が開いたほうが分かる
  it('どちらも無ければ、宮殿を開く', () => {
    expect(previewEntryPath(preview())).toBe('/dashboard')
  })

  it('下見していなければ、宮殿を開く', () => {
    expect(previewEntryPath({ active: false })).toBe('/dashboard')
  })
})

// **工房室では帯を出さない。**
// あそこは下見を始めた側で、「工房室へ戻る」と言われても戻る先が今そこ
describe('帯を出す場所', () => {
  it('ふつうの画面では出す', () => {
    expect(showsPreviewBanner('/boxes/abc')).toBe(true)
    expect(showsPreviewBanner('/dashboard')).toBe(true)
    expect(showsPreviewBanner('/views/abc')).toBe(true)
  })

  it('工房室では出さない', () => {
    expect(showsPreviewBanner('/studio')).toBe(false)
    expect(showsPreviewBanner('/studio/items')).toBe(false)
    expect(showsPreviewBanner('/studio/publish')).toBe(false)
  })

  // 執務室は別の場所。下見の帯は出してよい
  it('執務室では出す', () => {
    expect(showsPreviewBanner('/admin')).toBe(true)
  })

  it('場所が分からなければ、出さない', () => {
    expect(showsPreviewBanner(null)).toBe(false)
    expect(showsPreviewBanner(undefined)).toBe(false)
  })
})
