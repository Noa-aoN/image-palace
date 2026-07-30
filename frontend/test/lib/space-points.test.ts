import { describe, expect, it } from 'vitest'
import { pointCssTransform, pointImageUrl } from '@/lib/space-points'

const point = (over: Record<string, unknown> = {}) =>
  ({ rotation_x: 0, rotation_y: 0, rotation_z: 0, ...over }) as never

describe('pointCssTransform', () => {
  it('回転が無いときは余計な変換を挟まない', () => {
    expect(pointCssTransform(point())).toBe('')
    expect(pointCssTransform(point(), { scale: 1.5 })).toBe('scale(1.5)')
  })

  // three.js は +Y が上、CSS は +Y が下。X と Z は回る向きが逆になるため符号を反転する。
  // ここを取り違えると 2D だけ鏡像になり、同じ点なのに 2D と 3D で見え方が食い違う。
  it('X 軸と Z 軸は符号を反転する', () => {
    expect(pointCssTransform(point({ rotation_x: 30 }))).toContain('rotateX(-30deg)')
    expect(pointCssTransform(point({ rotation_z: 90 }))).toContain('rotateZ(-90deg)')
  })

  it('Y 軸はそのまま（どちらも右端が奥へ回る）', () => {
    expect(pointCssTransform(point({ rotation_y: 45 }))).toContain('rotateY(45deg)')
  })

  it('傾きがあるときだけ遠近を効かせる', () => {
    expect(pointCssTransform(point({ rotation_z: 20 }))).not.toContain('perspective')
    expect(pointCssTransform(point({ rotation_x: 20 }))).toContain('perspective(')
    expect(pointCssTransform(point({ rotation_y: 20 }))).toContain('perspective(')
  })

  // three.js の Euler 'XYZ' と合成順を揃える
  it('X → Y → Z の順で並べる', () => {
    const t = pointCssTransform(point({ rotation_x: 10, rotation_y: 20, rotation_z: 30 }), { scale: 2 })
    expect(t.indexOf('scale(')).toBeLessThan(t.indexOf('perspective('))
    expect(t.indexOf('rotateX(')).toBeLessThan(t.indexOf('rotateY('))
    expect(t.indexOf('rotateY(')).toBeLessThan(t.indexOf('rotateZ('))
  })
})

describe('pointImageUrl', () => {
  it('生成画像を優先し、無ければ配置カードの画像を使う', () => {
    const generated = { image: { thumb_url: 'a', url: 'b' }, item: { media: { thumb_url: 'c' } } } as never
    const placed = { image: null, item: { media: { thumb_url: 'c', url: 'd' } } } as never
    expect(pointImageUrl(generated)).toBe('a')
    expect(pointImageUrl(placed)).toBe('c')
  })

  it('どちらも無ければ null', () => {
    expect(pointImageUrl({ image: null, item: null } as never)).toBeNull()
  })
})
