import { describe, it, expect } from 'vitest'
import { DEMO_LOCKED_HINT, lockedForDemo } from '@/lib/demo/navigation'

// **隠さない。灰色にして、押せなくする。**
//
// 消すと「この宮殿にはそれが無い」と読まれる。
// 体験は本物がどういうものかを見てもらう場なので、
// あることは見せて、いまは使えないことだけを伝える
describe('体験中に触れない場所', () => {
  describe('使えるもの', () => {
    it('作る場所は使える', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/items/new' })).toBe(false)
      expect(lockedForDemo({ sectionKey: 'palace', href: '/views/new' })).toBe(false)
    })

    it('見る場所は使える', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/items' })).toBe(false)
      expect(lockedForDemo({ sectionKey: 'palace', href: '/boxes' })).toBe(false)
    })

    it('おぼえる場所は使える', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/study/quiz' })).toBe(false)
    })

    it('入口は使える', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/entrance' })).toBe(false)
    })
  })

  describe('使えないもの', () => {
    // 口座に紐づくもの。使い捨ての口座で触っても意味が無い
    it('マイルームの中は使えない', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/settings' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'palace', href: '/billing' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'palace', href: '/account' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'palace', href: '/achievements' })).toBe(true)
    })

    it('マイルームの奥のページも使えない', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/account/security' })).toBe(true)
    })

    // クレジットが要るもの・まだ無いもの
    it('市街はまるごと使えない', () => {
      expect(lockedForDemo({ sectionKey: 'outside', href: '/delphi' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'outside', href: '/agora' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'outside', href: '/stadion' })).toBe(true)
    })

    it('公庁はまるごと使えない', () => {
      expect(lockedForDemo({ sectionKey: 'ops', href: '/news' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'ops', href: '/blog' })).toBe(true)
    })

    it('入口の名前が無くても、節で決まる', () => {
      expect(lockedForDemo({ sectionKey: 'outside' })).toBe(true)
      expect(lockedForDemo({ sectionKey: 'palace' })).toBe(false)
    })
  })

  // **体験中こそ役に立つものは、節が閉じていても開けておく**
  describe('例外', () => {
    it('使い方は押せる', () => {
      expect(lockedForDemo({ sectionKey: 'ops', href: '/guide' })).toBe(false)
    })
  })

  // 名前が似ているだけの入口を、巻き込んで閉じない
  describe('取り違えない', () => {
    it('前方一致で余計なものを閉じない', () => {
      expect(lockedForDemo({ sectionKey: 'palace', href: '/settings-guide' })).toBe(false)
      expect(lockedForDemo({ sectionKey: 'palace', href: '/accounts' })).toBe(false)
    })
  })

  it('なぜ使えないのかを言う', () => {
    expect(DEMO_LOCKED_HINT).toContain('体験の宮殿では使えません')
    expect(DEMO_LOCKED_HINT).toContain('自分の宮殿')
  })
})
