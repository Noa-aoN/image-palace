import { describe, expect, it } from 'vitest'
import { axisForHandle, orthogonalize } from '@/lib/edge-path'

// 線が斜めになるのは、点どうしが軸に揃っていないから。
// 折れ点はサーバーが「既定のカードの大きさ」で計算するが、実際の大きさは違う。
describe('orthogonalize', () => {
  it('揃っていない2点の間に角を1つ挟む', () => {
    const out = orthogonalize([{ x: 0, y: 0 }, { x: 100, y: 50 }], 'vertical')

    expect(out).toEqual([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }])
  })

  it('出る向きが横なら、先に横へ動く', () => {
    const out = orthogonalize([{ x: 0, y: 0 }, { x: 100, y: 50 }], 'horizontal')

    expect(out).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }])
  })

  it('既に揃っている点はそのまま（角を増やさない）', () => {
    const points = [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }]

    expect(orthogonalize(points, 'vertical')).toEqual(points)
  })

  it('どの線分も水平か垂直になる', () => {
    const out = orthogonalize(
      [{ x: 0, y: 0 }, { x: 37, y: 91 }, { x: 210, y: 140 }, { x: 55, y: 300 }],
      'vertical'
    )

    for (let i = 1; i < out.length; i++) {
      const dx = Math.abs(out[i].x - out[i - 1].x)
      const dy = Math.abs(out[i].y - out[i - 1].y)
      expect(dx < 0.5 || dy < 0.5).toBe(true)
    }
  })

  it('重なった点は落とす', () => {
    const out = orthogonalize([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 50 }], 'vertical')

    expect(out).toEqual([{ x: 0, y: 0 }, { x: 0, y: 50 }])
  })

  it('点が1つ以下なら何もしない', () => {
    expect(orthogonalize([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }])
  })
})

describe('axisForHandle', () => {
  it('左右の取っ手からは横へ出る', () => {
    expect(axisForHandle('left')).toBe('horizontal')
    expect(axisForHandle('right')).toBe('horizontal')
  })

  it('上下と、指定が無いときは縦へ出る', () => {
    expect(axisForHandle('top')).toBe('vertical')
    expect(axisForHandle('bottom')).toBe('vertical')
    expect(axisForHandle(null)).toBe('vertical')
  })
})

import { EDGE_STUB, JUNCTION_STUB, stubFor, withStubs } from '@/lib/edge-path'

// カードの縁を出てすぐ曲がると、線がそのカードの側面に張り付いて走る。
describe('withStubs', () => {
  it('出る辺の向きへ、まっすぐ助走を足す', () => {
    const out = withStubs([{ x: 100, y: 100 }, { x: 300, y: 300 }], 'bottom', 'top', 20)

    expect(out[1]).toEqual({ x: 100, y: 120 })
    expect(out[out.length - 2]).toEqual({ x: 300, y: 280 })
  })

  it('左右の辺からは横へ出る', () => {
    const out = withStubs([{ x: 100, y: 100 }, { x: 300, y: 100 }], 'right', 'left', 20)

    expect(out[1]).toEqual({ x: 120, y: 100 })
    expect(out[out.length - 2]).toEqual({ x: 280, y: 100 })
  })

  it('助走を足したあと直交させても、曲がる場所はカードから離れている', () => {
    const stubbed = withStubs([{ x: 100, y: 100 }, { x: 300, y: 300 }], 'bottom', 'top', 20)
    const path = orthogonalize(stubbed, 'vertical')

    // 最初の線分は、出た辺と直角（縦）に 20 以上
    expect(path[1].x).toBe(100)
    expect(path[1].y - path[0].y).toBeGreaterThanOrEqual(20)
  })

  it('取っ手が分からないときは足さない（向きを当てずっぽうで決めない）', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }]

    expect(withStubs(points, null, null)).toEqual(points)
  })

  // 端はカードの縁まで届かせる（矢印は届いてこそ「これを指している」と読める）。
  // そのぶん、曲がってから縁までの直線に矢じりが入る長さが要る
  it('助走は矢じりが入る長さを取る', () => {
    expect(EDGE_STUB).toBeGreaterThanOrEqual(24)
  })

  it('助走を足しても、端の点は動かない（縁に届いたまま）', () => {
    const ends = [{ x: 100, y: 100 }, { x: 300, y: 300 }]
    const out = withStubs(ends, 'bottom', 'top')

    expect(out[0]).toEqual(ends[0])
    expect(out[out.length - 1]).toEqual(ends[1])
  })
})

// 決め打ちの長さで助走を置くと、線が既にカードの近くを走っているときに
// その線より外へ飛び出してから戻る＝端で折り返して見える。
describe('withStubs（折り返しを作らない）', () => {
  it('隣の点より外へは出さない', () => {
    // 上から 10px のところを走ってきて、上辺へ入る
    const out = withStubs([{ x: 0, y: 90 }, { x: 100, y: 100 }], null, 'top', 28)

    // 助走は 10 まで。28 にすると y=72 まで飛び出して戻ることになる
    expect(out[out.length - 2]).toEqual({ x: 100, y: 90 })
  })

  it('隣の点が反対側にあるときは、回り込むぶんを伸ばす', () => {
    // 下から来て上辺へ入る＝カードを回り込む必要がある
    const out = withStubs([{ x: 0, y: 300 }, { x: 100, y: 100 }], null, 'top', 28)

    expect(out[out.length - 2]).toEqual({ x: 100, y: 72 })
  })

  it('出る側も同じ（隣の点より外へ出ない）', () => {
    const out = withStubs([{ x: 100, y: 100 }, { x: 100, y: 110 }], 'bottom', null, 28)

    expect(out[1]).toEqual({ x: 100, y: 110 })
  })

  it('隣が同じ場所なら助走を足さない', () => {
    const points = [{ x: 100, y: 100 }, { x: 100, y: 100 }]

    expect(withStubs(points, 'bottom', null, 28)).toEqual(points)
  })
})

/**
 * 接合点から出る線の助走。
 *
 * 助走はカードの縁に線が張り付かないようにするためのもので、
 * 点から出る線には要らない。28px も取ると、元の線から離れて生えたように見える。
 */
describe('stubFor', () => {
  it('カードからは、これまでどおり離れる', () => {
    expect(stubFor(false)).toBe(EDGE_STUB)
  })

  it('接合点からは、短く離れる', () => {
    expect(stubFor(true)).toBe(JUNCTION_STUB)
    expect(stubFor(true)).toBeLessThan(EDGE_STUB)
  })
})

describe('withStubs（端ごとに長さを変える）', () => {
  const line = [
    { x: 100, y: 100 },
    { x: 100, y: 500 },
  ]

  it('出る側と着く側で、別の長さを取れる', () => {
    const out = withStubs(line, 'bottom', 'top', { source: 6, target: 28 })

    expect(out[1]).toEqual({ x: 100, y: 106 })
    expect(out[out.length - 2]).toEqual({ x: 100, y: 472 })
  })

  it('0 を渡した側には助走を足さない', () => {
    const out = withStubs(line, 'bottom', 'top', { source: 0, target: 20 })

    expect(out[1]).toEqual({ x: 100, y: 480 })
    expect(out).toHaveLength(3)
  })

  it('数を1つ渡したときは、これまでどおり両端に同じ長さ', () => {
    const out = withStubs(line, 'bottom', 'top', 20)

    expect(out[1]).toEqual({ x: 100, y: 120 })
    expect(out[out.length - 2]).toEqual({ x: 100, y: 480 })
  })
})
