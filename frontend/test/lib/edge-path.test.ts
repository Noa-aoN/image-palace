import { describe, expect, it } from 'vitest'
import {
  buildEdgePath,
  dashArrayFor,
  resolveLineStyle,
  portedPoint,
  pointAtFraction,
  DEFAULT_CURVE_RADIUS,
} from '@/lib/edge-path'

const A = { x: 0, y: 0 }
const B = { x: 100, y: 0 }
const C = { x: 100, y: 100 }

describe('buildEdgePath', () => {
  it('2点なら直線', () => {
    expect(buildEdgePath([A, B])).toBe('M 0 0 L 100 0')
  })

  it('角ばるは折れ点をそのままつなぐ', () => {
    expect(buildEdgePath([A, B, C], 'sharp')).toBe('M 0 0 L 100 0 L 100 100')
  })

  it('角を丸めると、角の手前で止まって曲がる', () => {
    const path = buildEdgePath([A, B, C], 'round', 20)

    // 角（100,0）そのものへは L で行かず、Q の制御点として使う
    expect(path).toContain('Q 100 0')
    expect(path).toBe('M 0 0 L 80 0 Q 100 0 100 20 L 100 100')
  })

  // 丸めすぎると曲線どうしが食い合って、線が縮んで見える
  it('丸みは線分の半分を超えない', () => {
    const path = buildEdgePath([A, B, C], 'round', 500)

    expect(path).toBe('M 0 0 L 50 0 Q 100 0 100 50 L 100 100')
  })

  // 置いた点を通らない曲線にすると、掴んでいるものと動くものがずれる
  it('なめらかでも折れ点は通る', () => {
    const path = buildEdgePath([A, B, C], 'smooth')

    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path).toContain('100 0')
    expect(path.endsWith('100 100')).toBe(true)
  })

  it('点が足りなければ空', () => {
    expect(buildEdgePath([A])).toBe('')
  })
})

describe('dashArrayFor', () => {
  it('実線と二重線は刻まない', () => {
    expect(dashArrayFor('solid', 2)).toBeUndefined()
    expect(dashArrayFor('double', 2)).toBeUndefined()
  })

  // 固定値だと、太い線で点線が繋がって見え、細い線で隙間が空きすぎる
  it('太さに応じて刻みが変わる', () => {
    expect(dashArrayFor('dashed', 2)).not.toBe(dashArrayFor('dashed', 10))
    expect(dashArrayFor('dotted', 2)).not.toBe(dashArrayFor('dotted', 10))
  })
})

describe('resolveLineStyle', () => {
  // 移行前のボードを壊さない
  it('line_style が無ければ旧 dashed を見る', () => {
    expect(resolveLineStyle({ dashed: true })).toBe('dashed')
    expect(resolveLineStyle({ dashed: false })).toBe('solid')
    expect(resolveLineStyle({})).toBe('solid')
  })

  it('line_style があればそちらが勝つ', () => {
    expect(resolveLineStyle({ line_style: 'dotted', dashed: true })).toBe('dotted')
  })
})

describe('DEFAULT_CURVE_RADIUS', () => {
  it('折れ点の位置が分からなくなるほど大きくしない', () => {
    expect(DEFAULT_CURVE_RADIUS).toBeLessThanOrEqual(24)
  })
})

/**
 * ポートと、線の上の文字の位置。
 *
 * サーバーが「辺のどこから出るか」を割り振っても、画面が辺の中心から描いたら
 * 扇の根元は1点に戻る。**両側が同じ形を描くこと**が要る。
 */
describe('portedPoint', () => {
  it('上下の辺では、辺に沿って横へずれる（辺から浮かない）', () => {
    expect(portedPoint({ x: 100, y: 50 }, 'bottom', 30)).toEqual({ x: 130, y: 50 })
    expect(portedPoint({ x: 100, y: 50 }, 'top', -30)).toEqual({ x: 70, y: 50 })
  })

  it('左右の辺では、辺に沿って縦へずれる', () => {
    expect(portedPoint({ x: 100, y: 50 }, 'right', 20)).toEqual({ x: 100, y: 70 })
    expect(portedPoint({ x: 100, y: 50 }, 'left', -20)).toEqual({ x: 100, y: 30 })
  })

  it('ずれが無ければ、そのまま返す（古いデータは今までどおり）', () => {
    const point = { x: 100, y: 50 }
    expect(portedPoint(point, 'bottom', undefined)).toBe(point)
    expect(portedPoint(point, 'bottom', 0)).toBe(point)
  })
})

describe('pointAtFraction', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]

  it('既定は真ん中', () => {
    expect(pointAtFraction(line)).toEqual({ x: 50, y: 0 })
  })

  it('道のりの割合で測る（頂点の数ではない）', () => {
    // 前半が長い折れ線。頂点の真ん中を採ると角に寄ってしまう
    const bent = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 100 },
    ]
    expect(pointAtFraction(bent, 0.5)).toEqual({ x: 200, y: 0 })
  })

  it('前後へずらせる（重なった文字を離すのに使う）', () => {
    expect(pointAtFraction(line, 0.35)).toEqual({ x: 35, y: 0 })
    expect(pointAtFraction(line, 0.65)).toEqual({ x: 65, y: 0 })
  })

  it('範囲の外を渡されても線の上に留まる', () => {
    expect(pointAtFraction(line, -1)).toEqual({ x: 0, y: 0 })
    expect(pointAtFraction(line, 5)).toEqual({ x: 100, y: 0 })
  })

  it('長さが0の線でも落ちない', () => {
    expect(pointAtFraction([{ x: 7, y: 7 }, { x: 7, y: 7 }], 0.5)).toEqual({ x: 7, y: 7 })
    expect(pointAtFraction([])).toEqual({ x: 0, y: 0 })
  })
})
