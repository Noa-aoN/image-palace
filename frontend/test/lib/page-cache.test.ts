import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  readPageCache,
  writePageCache,
  clearPageCache,
  setPageCacheClock,
} from '@/lib/page-cache'

describe('page-cache', () => {
  let current = 0

  beforeEach(() => {
    current = 1_000_000
    setPageCacheClock(() => current)
    clearPageCache()
  })

  afterEach(() => {
    setPageCacheClock(() => Date.now())
    clearPageCache()
  })

  it('書いた内容をそのまま読み出せる', () => {
    writePageCache('items', [{ id: '1' }])

    expect(readPageCache('items')).toEqual([{ id: '1' }])
  })

  it('書いていないキーは undefined を返す', () => {
    expect(readPageCache('none')).toBeUndefined()
  })

  it('同じキーへ書くと後から書いた内容で置き換わる', () => {
    writePageCache('items', ['old'])
    writePageCache('items', ['new'])

    expect(readPageCache('items')).toEqual(['new'])
  })

  it('古さの上限を過ぎた内容は返さない', () => {
    writePageCache('items', ['stale'])
    current += 5 * 60 * 1000 + 1

    expect(readPageCache('items')).toBeUndefined()
  })

  it('上限内であれば返す', () => {
    writePageCache('items', ['fresh'])
    current += 5 * 60 * 1000 - 1

    expect(readPageCache('items')).toEqual(['fresh'])
  })

  it('キーを指定して消せる', () => {
    writePageCache('a', [1])
    writePageCache('b', [2])
    clearPageCache('a')

    expect(readPageCache('a')).toBeUndefined()
    expect(readPageCache('b')).toEqual([2])
  })

  it('キーなしで消すと全部消える', () => {
    writePageCache('a', [1])
    writePageCache('b', [2])
    clearPageCache()

    expect(readPageCache('a')).toBeUndefined()
    expect(readPageCache('b')).toBeUndefined()
  })
})
