import { describe, expect, it } from 'vitest'
import { wallViewFloorGrid } from '@/lib/room-surfaces'

// 壁ビューの床は台形。奥辺 (17,72)-(83,72) / 手前辺 (0,100)-(100,100)
// 台形の左右の境界は y に対して線形なので、y から許容 x 範囲を求められる
function boundsAt(y: number): { min: number; max: number } {
  const t = (y - 72) / 28 // 0 = 奥, 1 = 手前
  return { min: 17 - 17 * t, max: 83 + 17 * t }
}

describe('wallViewFloorGrid', () => {
  it('すべての線分が床の台形の内側に収まる', () => {
    for (const wall of ['wall_north', 'wall_east', 'wall_south', 'wall_west'] as const) {
      for (const line of wallViewFloorGrid(wall, 6, 4)) {
        for (const [x, y] of [
          [line.x1, line.y1],
          [line.x2, line.y2],
        ]) {
          expect(y).toBeGreaterThanOrEqual(72)
          expect(y).toBeLessThanOrEqual(100)
          const b = boundsAt(y)
          expect(x).toBeGreaterThanOrEqual(b.min - 1e-6)
          expect(x).toBeLessThanOrEqual(b.max + 1e-6)
        }
      }
    }
  })

  it('部屋が広いほど線が増える（1m 間隔）', () => {
    const small = wallViewFloorGrid('wall_north', 4, 4)
    const large = wallViewFloorGrid('wall_north', 12, 12)
    expect(large.length).toBeGreaterThan(small.length)
  })

  // 向いている壁で h 軸・d 軸に対応する寸法が入れ替わる（floorHD と同じ対応）
  it('北の壁と東の壁では幅と奥行きの役割が入れ替わる', () => {
    const north = wallViewFloorGrid('wall_north', 10, 2)
    const east = wallViewFloorGrid('wall_east', 10, 2)
    expect(north.length).not.toBe(east.length)
    // 北向きは横方向が width(10m) ＝ 縦線が多い
    expect(north.filter((l) => l.y1 !== l.y2).length).toBe(11)
    // 東向きは横方向が depth(2m)
    expect(east.filter((l) => l.y1 !== l.y2).length).toBe(3)
  })

  it('奥行き方向は部屋の中央（壁から depth/2）までしか引かない', () => {
    // depth=8m なら壁から 0,1,2,3,4m の 5 本（4m = 中央）
    const lines = wallViewFloorGrid('wall_north', 4, 8).filter((l) => l.y1 === l.y2)
    expect(lines.length).toBe(5)
    expect(Math.max(...lines.map((l) => l.y1))).toBeCloseTo(100)
  })

  it('寸法が 0 や負でも線を生成できる（クラッシュしない）', () => {
    expect(() => wallViewFloorGrid('wall_north', 0, 0)).not.toThrow()
    expect(wallViewFloorGrid('wall_north', 0, 0).length).toBeGreaterThan(0)
  })
})
