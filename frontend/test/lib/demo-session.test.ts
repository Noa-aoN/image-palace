import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEMO_EMAIL_DOMAIN,
  clearResumeToken,
  daysLeft,
  isDemoUser,
  readOrCreateClientKey,
  readResumeToken,
  remainingLabel,
  saveResumeToken,
} from '@/lib/demo/session'

// 体験用の宮殿の、手元側の覚え書き。
//
// 合鍵が読み書きできないと、押すたびに新しい宮殿が建って上限を食い潰す。
// 体験用かどうかの見分けを間違えると、帯が出ない（消えることが伝わらない）か、
// 普通の利用者に出てしまう。
describe('体験用の宮殿の覚え書き', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('合鍵', () => {
    it('置いて、読み出せる', () => {
      saveResumeToken('abc.def')

      expect(readResumeToken()).toBe('abc.def')
    })

    it('無ければ null', () => {
      expect(readResumeToken()).toBeNull()
    })

    it('空のものは置かない（次に読んだとき紛らわしい）', () => {
      saveResumeToken('')
      saveResumeToken(null)
      saveResumeToken(undefined)

      expect(readResumeToken()).toBeNull()
    })

    it('消せる', () => {
      saveResumeToken('abc')
      clearResumeToken()

      expect(readResumeToken()).toBeNull()
    })

    // プライベートモード等で保存が使えないことがある。
    // **合鍵が無いだけで、宮殿は建つ**
    it('保存が使えなくても落ちない', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('保存できません')
      })

      expect(() => readResumeToken()).not.toThrow()
      expect(readResumeToken()).toBeNull()

      spy.mockRestore()
    })
  })

  describe('体験用かどうかの見分け', () => {
    it('後ろ側が体験用の綴りなら、体験用', () => {
      expect(isDemoUser({ email: `demo-abc@${DEMO_EMAIL_DOMAIN}` })).toBe(true)
    })

    it('大文字でも見分ける', () => {
      expect(isDemoUser({ email: `X@${DEMO_EMAIL_DOMAIN.toUpperCase()}` })).toBe(true)
    })

    it('普通の利用者には出さない', () => {
      expect(isDemoUser({ email: 'someone@example.com' })).toBe(false)
      expect(isDemoUser({ email: null })).toBe(false)
      expect(isDemoUser(null)).toBe(false)
      expect(isDemoUser(undefined)).toBe(false)
    })

    // **紛らわしいものを通さない。** 途中に入っていても体験用ではない
    it('綴りが途中にあるだけでは、体験用にしない', () => {
      expect(isDemoUser({ email: `a@${DEMO_EMAIL_DOMAIN}.example.com` })).toBe(false)
      expect(isDemoUser({ email: `${DEMO_EMAIL_DOMAIN}@example.com` })).toBe(false)
    })
  })

  describe('あと何日か', () => {
    const now = new Date('2026-08-20T12:00:00Z')

    it('切り上げる（「あと0日」と出さない）', () => {
      expect(daysLeft('2026-08-21T06:00:00Z', now)).toBe(1)
      expect(daysLeft('2026-08-22T18:00:00Z', now)).toBe(3)
    })

    it('過ぎていたら0', () => {
      expect(daysLeft('2026-08-19T12:00:00Z', now)).toBe(0)
    })

    it('分からなければ null', () => {
      expect(daysLeft(null, now)).toBeNull()
      expect(daysLeft('でたらめ', now)).toBeNull()
    })
  })

  describe('残りの言い方', () => {
    const now = new Date('2026-08-20T12:00:00Z')

    // 1日を切ったら時間で言う。**そのほうが正直**
    it('1日を切ったら時間で言う', () => {
      expect(remainingLabel('2026-08-20T18:00:00Z', now)).toBe('あと約6時間')
      expect(remainingLabel('2026-08-21T11:00:00Z', now)).toBe('あと約23時間')
    })

    it('1日を超えたら日で言う', () => {
      expect(remainingLabel('2026-08-22T12:00:00Z', now)).toBe('あと約2日')
    })

    it('過ぎていたら、まもなく消えると言う', () => {
      expect(remainingLabel('2026-08-19T12:00:00Z', now)).toBe('まもなく消えます')
    })

    it('分からなければ出さない', () => {
      expect(remainingLabel(null, now)).toBeNull()
      expect(remainingLabel('でたらめ', now)).toBeNull()
    })
  })
})

// 合鍵は「1回目の返事」を受け取ってからしか持てない。
// だから初めての1回がほぼ同時に2本出ると、宮殿が2つ建つ。
// 合言葉は要求を出す前に作れるので、その隙間を塞げる
describe('画面が自分で持つ合言葉', () => {
  beforeEach(() => window.localStorage.clear())

  it('はじめて呼ぶと作られる', () => {
    const key = readOrCreateClientKey()

    expect(key).toBeTruthy()
    expect(window.localStorage.getItem('demo-client-key')).toBe(key)
  })

  it('2回目は同じものが返る', () => {
    expect(readOrCreateClientKey()).toBe(readOrCreateClientKey())
  })

  // **合鍵とは別の引き出しに置く。** 体験を終えると合鍵は捨てるが、
  // 合言葉は残ってよい（サーバーは生きている宮殿しか引かない）
  it('合鍵を捨てても残る', () => {
    const key = readOrCreateClientKey()
    clearResumeToken()

    expect(readOrCreateClientKey()).toBe(key)
  })

  it('合鍵とは別の鍵で持つ', () => {
    readOrCreateClientKey()
    saveResumeToken('resume-abc')

    expect(window.localStorage.getItem('demo-client-key'))
      .not.toBe(window.localStorage.getItem('demo-resume-token'))
  })
})
