import { describe, it, expect } from 'vitest'
import { omittedKeysForPreset } from '@/lib/block-visibility'

// 畳みすぎ・畳み漏れは、どちらも「画面から何かが消える」形で出る。
// 目で見て気づける保証がないので、ここで固定する
describe('omittedKeysForPreset', () => {
  const all = ['image', 'meaning', 'examples', 'prop:wikipedia', 'prop:reading', 'property_tools']

  it('ひな型に無い作り付けの札は畳む', () => {
    const omitted = omittedKeysForPreset(all, new Set(['image', 'meaning']))

    expect(omitted.has('examples')).toBe(true)
  })

  it('ひな型にある札は畳まない', () => {
    const omitted = omittedKeysForPreset(all, new Set(['image', 'meaning']))

    expect(omitted.has('image')).toBe(false)
    expect(omitted.has('meaning')).toBe(false)
  })

  // ひな型を決めたあとに足した項目まで畳むと、
  // Wikipedia を足しても既存のカードに出てこない
  it('種別に足した項目（prop:）は畳まない', () => {
    const omitted = omittedKeysForPreset(all, new Set(['image']))

    expect(omitted.has('prop:wikipedia')).toBe(false)
    expect(omitted.has('prop:reading')).toBe(false)
  })

  // 畳むと、ひな型を当てた瞬間に項目を足す方法が画面から消える
  it('道具は畳まない（項目を足す入口が消える）', () => {
    const omitted = omittedKeysForPreset(all, new Set(['image']))

    expect(omitted.has('property_tools')).toBe(false)
  })

  it('ひな型が空でも、項目と道具は残る', () => {
    const omitted = omittedKeysForPreset(all, new Set())

    expect([...omitted]).toEqual(['image', 'meaning', 'examples'])
  })
})
