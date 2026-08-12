import { describe, it, expect, vi } from 'vitest'
import { isSubmitEnter, onEnter } from '@/lib/enter-key'
import type { KeyboardEvent } from 'react'

const event = (key: string, native: Partial<globalThis.KeyboardEvent> = {}) =>
  ({
    key,
    preventDefault: vi.fn(),
    nativeEvent: { isComposing: false, keyCode: key === 'Enter' ? 13 : 0, ...native },
  }) as unknown as KeyboardEvent

// 日本語を打つ人にとって、Enter は2度押すもの。
// 1度目は変換の確定で、2度目でようやく決定になる
describe('決定の Enter か', () => {
  it('変換していない Enter は決定', () => {
    expect(isSubmitEnter(event('Enter'))).toBe(true)
  })

  // ここが要。「宮殿」と打とうとしただけで「きゅうでん」が保存される
  it('変換中の Enter は決定にしない', () => {
    expect(isSubmitEnter(event('Enter', { isComposing: true }))).toBe(false)
  })

  // 古い Safari は変換中に isComposing を立てないことがある
  it('keyCode 229（変換中の約束事）も決定にしない', () => {
    expect(isSubmitEnter(event('Enter', { keyCode: 229 }))).toBe(false)
  })

  it('Enter 以外は決定にしない', () => {
    expect(isSubmitEnter(event('a'))).toBe(false)
    expect(isSubmitEnter(event('Escape'))).toBe(false)
  })
})

describe('onEnter', () => {
  it('決定のときだけ呼ぶ', () => {
    const handler = vi.fn()

    onEnter(handler)(event('Enter'))

    expect(handler).toHaveBeenCalledOnce()
  })

  it('変換中は呼ばない', () => {
    const handler = vi.fn()

    onEnter(handler)(event('Enter', { isComposing: true }))

    expect(handler).not.toHaveBeenCalled()
  })

  // 呼ぶときだけ止める。関係ないキーまで止めると、入力そのものが壊れる
  it('決定のときだけ既定の動きを止める', () => {
    const submit = event('Enter')
    const composing = event('Enter', { isComposing: true })

    onEnter(vi.fn())(submit)
    onEnter(vi.fn())(composing)

    expect(submit.preventDefault).toHaveBeenCalledOnce()
    expect(composing.preventDefault).not.toHaveBeenCalled()
  })
})
