import { describe, it, expect } from 'vitest'
import { shouldAutoLookup } from '@/lib/wikipedia-auto-lookup'

// 勝手に走ってよい場面は狭い。広げると、手で選んだ記事が黙って別のものに変わる
describe('shouldAutoLookup', () => {
  const base = { justCreated: true, hasValue: false, alreadyStarted: false }

  it('作った直後・値なし・未実行なら走る', () => {
    expect(shouldAutoLookup(base)).toBe(true)
  })

  // カードを開くたびに引き直したら、手で選んだ記事が入れ替わる
  it('既にある項目では走らない', () => {
    expect(shouldAutoLookup({ ...base, justCreated: false })).toBe(false)
  })

  it('値があれば走らない', () => {
    expect(shouldAutoLookup({ ...base, hasValue: true })).toBe(false)
  })

  // 候補を選んでいる最中に引き直すと、選択が消える
  it('一度走ったら二度目は走らない', () => {
    expect(shouldAutoLookup({ ...base, alreadyStarted: true })).toBe(false)
  })

  it('条件が1つでも欠ければ走らない', () => {
    expect(shouldAutoLookup({ justCreated: false, hasValue: true, alreadyStarted: true })).toBe(false)
  })
})
