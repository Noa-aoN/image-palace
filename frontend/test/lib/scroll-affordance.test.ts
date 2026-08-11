import { describe, it, expect } from 'vitest'
import { hasMoreBelow } from '@/lib/scroll-affordance'

// 高さで切った領域は、切ったことが見た目に出ない。
// 「続きがあるか」を取り違えると、読み手は文の途中で読むのをやめる
describe('hasMoreBelow', () => {
  it('入り切らないぶんがあれば true', () => {
    expect(hasMoreBelow({ scrollTop: 0, scrollHeight: 500, clientHeight: 200 })).toBe(true)
  })

  it('全部見えていれば false（短い文でぼかさない）', () => {
    expect(hasMoreBelow({ scrollTop: 0, scrollHeight: 180, clientHeight: 200 })).toBe(false)
  })

  it('端まで送ったら false（最後の一行を薄いままにしない）', () => {
    expect(hasMoreBelow({ scrollTop: 300, scrollHeight: 500, clientHeight: 200 })).toBe(false)
  })

  it('途中まで送った状態では true', () => {
    expect(hasMoreBelow({ scrollTop: 100, scrollHeight: 500, clientHeight: 200 })).toBe(true)
  })

  // 拡大表示や端数のある行送りでは、端まで送っても1px弱だけ残ることがある
  it('端の1px未満のズレは端とみなす', () => {
    expect(hasMoreBelow({ scrollTop: 299.4, scrollHeight: 500, clientHeight: 200 })).toBe(false)
  })
})
