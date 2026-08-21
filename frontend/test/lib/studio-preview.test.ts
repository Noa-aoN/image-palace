import { describe, it, expect } from 'vitest'
import { previewEntryPath, previewSubject, showsPreviewBanner } from '@/lib/studio/preview'
import type { PreviewState } from '@/lib/api/studio'

function preview(over: Partial<Extract<PreviewState, { active: true }>> = {}): PreviewState {
  return {
    active: true,
    key: 'starter_it',
    version: 3,
    name: 'ITのことば',
    status: 'published',
    box_id: null,
    view_id: null,
    items: 12,
    expires_at: '2026-08-22T00:00:00Z',
    stale: false,
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

// **色だけに頼らず、文字で言う。**
// 下書きの下見と、出しているものの下見は意味がまるで違う
describe('何を下見しているか', () => {
  it('出しているものは、公開版だと言う', () => {
    expect(previewSubject(preview()).label).toContain('公開版 v3')
    expect(previewSubject(preview()).label).toContain('ITのことば')
  })

  it('下書きは、下書きだと言う', () => {
    expect(previewSubject(preview({ status: 'draft' })).label).toContain('下書き v3')
  })

  // まだ誰にも届いていないことを、はっきり書く
  it('下書きには、まだ配布されていないと書き添える', () => {
    expect(previewSubject(preview({ status: 'draft' })).note).toContain('まだ一般には配布されていません')
  })

  it('出しているものには、余計な但し書きを付けない', () => {
    expect(previewSubject(preview({ status: 'published' })).note).toBeNull()
  })

  it('止めているもの・終えたものも、そうと言う', () => {
    expect(previewSubject(preview({ status: 'suspended' })).label).toContain('止めている')
    expect(previewSubject(preview({ status: 'archived' })).label).toContain('終了した')
  })

  // 下書きを作り直すと、元の行が消えることがある。中身は固まったままなので見られる
  it('元の荷物が無くなっていても、見ているものは言える', () => {
    const subject = previewSubject(preview({ status: null }))

    expect(subject.label).toContain('v3')
    expect(subject.note).toContain('元の荷物はもうありません')
  })

  it('下見していなければ、何も言わない', () => {
    expect(previewSubject({ active: false }).label).toBe('')
  })
})
