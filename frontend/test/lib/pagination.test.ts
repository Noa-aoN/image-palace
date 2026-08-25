import { describe, it, expect } from 'vitest'
import { PAGE_GAP, canGoTo, pageWindow } from '@/lib/pagination'

// 「前へ / 次へ」だけだと、40ページある一覧の最後まで39回押すことになる
describe('ページ送りの番号', () => {
  it('少なければ全部並べる', () => {
    expect(pageWindow(1, 5)).toEqual([ 1, 2, 3, 4, 5 ])
  })

  it('1ページしかなければ、それだけ', () => {
    expect(pageWindow(1, 1)).toEqual([ 1 ])
  })

  it('0ページなら何も出さない', () => {
    expect(pageWindow(1, 0)).toEqual([])
  })

  describe('多いとき', () => {
    it('先頭にいるなら、後ろを省く', () => {
      expect(pageWindow(1, 20)).toEqual([ 1, 2, 3, 4, 5, PAGE_GAP, 20 ])
    })

    it('末尾にいるなら、前を省く', () => {
      expect(pageWindow(20, 20)).toEqual([ 1, PAGE_GAP, 16, 17, 18, 19, 20 ])
    })

    it('真ん中にいるなら、両側を省く', () => {
      expect(pageWindow(10, 20)).toEqual([ 1, PAGE_GAP, 9, 10, 11, PAGE_GAP, 20 ])
    })

    // 省いた先が1つなら、その番号を出すほうが早い
    it('1ページだけを「…」で省かない', () => {
      expect(pageWindow(4, 20)).toEqual([ 1, 2, 3, 4, 5, PAGE_GAP, 20 ])
      expect(pageWindow(17, 20)).toEqual([ 1, PAGE_GAP, 16, 17, 18, 19, 20 ])
    })
  })

  // 端にいるときだけ数が減ると、送るたびに帯の幅が変わり、押した先のボタンが動く
  it('どこにいても、出る数がそろう', () => {
    const counts = [ 1, 2, 5, 10, 15, 19, 20 ].map((page) => pageWindow(page, 20).length)
    expect(new Set(counts).size).toBe(1)
  })

  it('範囲の外を渡されても、端に丸める', () => {
    expect(pageWindow(0, 20)).toEqual(pageWindow(1, 20))
    expect(pageWindow(99, 20)).toEqual(pageWindow(20, 20))
  })

  it('前後に出す数を増やせる', () => {
    expect(pageWindow(10, 40, 2)).toEqual([ 1, PAGE_GAP, 8, 9, 10, 11, 12, PAGE_GAP, 40 ])
  })
})

describe('押せる行き先か', () => {
  it('いまいるページは押させない', () => {
    expect(canGoTo(3, 3, 10)).toBe(false)
  })

  it('範囲の外は押させない', () => {
    expect(canGoTo(0, 3, 10)).toBe(false)
    expect(canGoTo(11, 3, 10)).toBe(false)
  })

  it('それ以外は押せる', () => {
    expect(canGoTo(1, 3, 10)).toBe(true)
    expect(canGoTo(10, 3, 10)).toBe(true)
  })
})
