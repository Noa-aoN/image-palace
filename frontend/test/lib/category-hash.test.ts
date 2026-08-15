import { describe, it, expect } from 'vitest'
import { sectionFromHash } from '@/lib/nav/section-hash'

// `/account#basic` のように、URL が項目を名指しして開けるか。
// **中身はログインの確認のあとに現れる**ので、素の飛び先合わせは当てにできない。
describe('URL が名指しする項目', () => {
  const keys = ['info', 'palace', 'basic', 'withdraw']

  it('名指しされた項目を返す', () => {
    expect(sectionFromHash('#basic', keys)).toBe('basic')
  })

  it('# が無くても読む', () => {
    expect(sectionFromHash('basic', keys)).toBe('basic')
  })

  it('日本語の鍵も読める（符号化されて届く）', () => {
    expect(sectionFromHash('#%E5%9F%BA%E6%9C%AC', ['基本'])).toBe('基本')
  })

  it('知らない名前は開かない（別の用途の # を取り違えない）', () => {
    expect(sectionFromHash('#nope', keys)).toBeNull()
  })

  it('空なら何も開かない', () => {
    expect(sectionFromHash('', keys)).toBeNull()
    expect(sectionFromHash('#', keys)).toBeNull()
  })

  it('壊れた符号でも落ちない', () => {
    expect(sectionFromHash('#%E0%A4%A', keys)).toBeNull()
  })
})
