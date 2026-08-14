import { describe, it, expect } from 'vitest'
import {
  ATELIER_EXAMPLES,
  ATELIER_KINDS,
  exampleIndexAt,
  previewFor,
  type AtelierKind,
} from '@/lib/atelier/examples'

// アトリエの作例。**素材が無くても画面が壊れない**ことが要。
describe('アトリエの作例', () => {
  it('種別がひとつ残らず登録されている（登録漏れは空欄の枠になる）', () => {
    for (const kind of ATELIER_KINDS) {
      expect(ATELIER_EXAMPLES[kind]).toBeDefined()
    }
  })

  it('素材がまだ無い種別は、図で見せる', () => {
    expect(previewFor('item')).toEqual({ mode: 'schematic' })
  })

  it('素材を入れた種別は、その絵を出す', () => {
    const kind = 'item' as AtelierKind
    const original = ATELIER_EXAMPLES[kind]
    ATELIER_EXAMPLES[kind] = ['/lp/item-1.webp', '/lp/item-2.webp']

    try {
      expect(previewFor(kind)).toEqual({
        mode: 'assets',
        sources: ['/lp/item-1.webp', '/lp/item-2.webp'],
      })
    } finally {
      ATELIER_EXAMPLES[kind] = original
    }
  })

  it('知らない種別を渡されても図に落とす（枠が空にならない）', () => {
    expect(previewFor('unknown' as AtelierKind)).toEqual({ mode: 'schematic' })
  })

  describe('何枚目を出すか', () => {
    it('順ぐりに回る', () => {
      expect([0, 1, 2, 3].map((step) => exampleIndexAt(step, 3))).toEqual([0, 1, 2, 0])
    })

    it('素材が1枚でも0枚でも範囲から出ない', () => {
      expect(exampleIndexAt(7, 1)).toBe(0)
      expect(exampleIndexAt(7, 0)).toBe(0)
    })

    it('負の歩数でも範囲から出ない', () => {
      expect(exampleIndexAt(-1, 3)).toBe(2)
    })
  })
})
