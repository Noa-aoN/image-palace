import { describe, it, expect } from 'vitest'
import { cardShows, densityFor } from '@/lib/items/card-density'

// 札は常に格子の幅いっぱいに広がる。変わるのは「その幅で何が読めるか」
describe('札の密度', () => {
  it('広い格子では、項目まで出す', () => {
    expect(densityFor(2)).toBe('full')
    expect(densityFor(6)).toBe('full')
  })

  // 5列で1枚 約260px。項目は1行に収まらなくなる
  it('狭くなったら、項目を落として見出しは残す', () => {
    expect(densityFor(7)).toBe('compact')
    expect(densityFor(8)).toBe('compact')
  })

  // 10列で1枚 約120px。読めない字を積んでも、絵が小さくなるだけ
  it('さらに狭ければ、絵だけにする', () => {
    expect(densityFor(9)).toBe('bare')
    expect(densityFor(10)).toBe('bare')
  })

  it('列数が段を戻ることは無い（広いほど出る）', () => {
    const order = { full: 3, compact: 2, bare: 1 }
    const counts = [ 2, 3, 4, 5, 6, 7, 8, 9, 10 ].map((c) => order[densityFor(c)])
    expect([ ...counts ].sort((a, b) => b - a)).toEqual(counts)
  })

  describe('何を出すか', () => {
    it('広ければ全部', () => {
      expect(cardShows('full')).toEqual({ title: true, fields: true, mark: true })
    })

    it('狭ければ項目を落とす', () => {
      expect(cardShows('compact')).toEqual({ title: true, fields: false, mark: true })
    })

    // 見出しはカードの身元。絵だけになるまでは落とさない
    it('絵だけのときは、見出しも印も出さない', () => {
      expect(cardShows('bare')).toEqual({ title: false, fields: false, mark: false })
    })
  })
})
