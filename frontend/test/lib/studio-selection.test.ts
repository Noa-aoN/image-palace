import { describe, it, expect } from 'vitest'
import {
  allChosen,
  bulkLabel,
  EMPTY,
  keepVisible,
  toggle,
  toggleAll,
} from '@/lib/studio/selection'

// 1つずつ押していくのは、数が増えると手数が増えるだけ。
// カードが84枚あるとき「出さない」を10枚に付けるのに10往復要る
describe('複数選び', () => {
  it('選ぶ・外すを繰り返せる', () => {
    let s = EMPTY
    s = toggle(s, 'a')
    expect(s.has('a')).toBe(true)

    s = toggle(s, 'a')
    expect(s.has('a')).toBe(false)
  })

  it('もとの集まりを書き換えない', () => {
    const before = EMPTY
    const after = toggle(before, 'a')

    expect(before.size).toBe(0)
    expect(after.size).toBe(1)
  })

  describe('まとめて選ぶ', () => {
    it('全部選ぶ', () => {
      expect([...toggleAll(EMPTY, ['a', 'b'])].sort()).toEqual(['a', 'b'])
    })

    it('全部選ばれていたら、全部外す', () => {
      const chosen = toggleAll(EMPTY, ['a', 'b'])

      expect(toggleAll(chosen, ['a', 'b']).size).toBe(0)
    })

    it('一部だけ選ばれていたら、全部選ぶ', () => {
      const partial = toggle(EMPTY, 'a')

      expect([...toggleAll(partial, ['a', 'b'])].sort()).toEqual(['a', 'b'])
    })

    // **見えているものだけ**を対象にする。
    // 絞り込んだ結果を「すべて選ぶ」で選んだつもりが、隠れているものまで
    // 入っていたら事故になる
    it('見えていないものは巻き込まない', () => {
      const s = toggleAll(EMPTY, ['a', 'b'])

      expect(s.has('c')).toBe(false)
    })

    it('見えているものが無ければ、何もしない', () => {
      expect(toggleAll(EMPTY, []).size).toBe(0)
    })
  })

  describe('全部選ばれているか', () => {
    it('全部あれば true', () => {
      expect(allChosen(toggleAll(EMPTY, ['a', 'b']), ['a', 'b'])).toBe(true)
    })

    it('欠けていれば false', () => {
      expect(allChosen(toggle(EMPTY, 'a'), ['a', 'b'])).toBe(false)
    })

    // 空を「全部選ばれている」と言わない（押す先が無いのに押せてしまう）
    it('見えているものが無ければ false', () => {
      expect(allChosen(EMPTY, [])).toBe(false)
    })
  })

  // **絞り込みを変えたときに呼ぶ。**
  // 見えなくなったものを選んだまま操作すると、画面に出ていないものが変わる
  describe('見えなくなったものを外す', () => {
    it('見えているものだけ残す', () => {
      const s = toggleAll(EMPTY, ['a', 'b', 'c'])

      expect([...keepVisible(s, ['a', 'c'])].sort()).toEqual(['a', 'c'])
    })

    it('全部見えなくなれば空になる', () => {
      expect(keepVisible(toggleAll(EMPTY, ['a']), []).size).toBe(0)
    })
  })

  // **何件に効くのかを必ず出す。** 数を言わないと、押す前に確かめようがない
  it('押す前に、何件に効くかを言う', () => {
    expect(bulkLabel('出さない', 3)).toBe('3 件を出さない')
  })
})
