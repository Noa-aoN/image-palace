import { describe, it, expect } from 'vitest'
import { availability, describeCounts, headlineCount } from '@/lib/content-packages/summary'

// 受け取る前に、中身を全部見せる必要はない。
// **何がいくつ届くか**だけ分かれば、押すかどうかは決められる。
describe('公式コンテンツの見せ方', () => {
  describe('中身の内訳', () => {
    it('入っているものだけ並べる', () => {
      expect(describeCounts({ items: 18, boxes: 2, views: 1, tags: 5 })).toEqual([
        'カード 18',
        'ボックス 2',
        'キャンバス 1',
        'タグ 5',
      ])
    })

    // 「キャンバス 0」と書いてあっても、読む人には何の足しにもならない
    it('0のものは並べない', () => {
      expect(describeCounts({ items: 10, boxes: 1, views: 0, tags: 0 })).toEqual([
        'カード 10',
        'ボックス 1',
      ])
    })

    it('分からなければ空', () => {
      expect(describeCounts(null)).toEqual([])
      expect(describeCounts(undefined)).toEqual([])
    })
  })

  describe('見出しの脇', () => {
    it('枚数が主役', () => {
      expect(headlineCount({ items: 18, boxes: 2, views: 1, tags: 5 })).toBe('18枚')
    })

    it('1枚も無ければ、準備中と言う', () => {
      expect(headlineCount({ items: 0, boxes: 0, views: 0, tags: 0 })).toBe('準備中')
      expect(headlineCount(null)).toBe('準備中')
    })
  })

  // 受け取り済みと、枠を使い切ったのは別のこと。
  // **前者はその荷物の話、後者はその人の話**
  describe('押せるかどうか', () => {
    it('まだ受け取っていなくて、枠があれば押せる', () => {
      expect(availability({ received: false }, 1)).toEqual({ canInstall: true })
    })

    it('受け取り済みなら、そう言う', () => {
      expect(availability({ received: true }, 1)).toEqual({
        canInstall: false,
        reason: 'received',
        message: '受け取り済み',
      })
    })

    it('枠を使い切っていたら、そう言う', () => {
      const result = availability({ received: false }, 0)

      expect(result.canInstall).toBe(false)
      expect(result).toMatchObject({ reason: 'no_free_left' })
    })

    // 受け取り済みが先。**その荷物の話のほうが、その人の話より近い**
    it('両方あてはまるときは、受け取り済みと言う', () => {
      expect(availability({ received: true }, 0)).toMatchObject({ reason: 'received' })
    })
  })
})
