import { describe, expect, it } from 'vitest'
import { isPublicPath } from '@/lib/auth/public-paths'

// ここが崩れると、読みものを読んでいる途中でログイン画面へ飛ばされる（またはその逆で、
// ログインが要る画面に留まって、何も出ないまま止まる）
describe('ログイン無しで読めるページ', () => {
  it('読みものは公開', () => {
    expect(isPublicPath('/guide')).toBe(true)
    expect(isPublicPath('/guide/faq')).toBe(true)
    expect(isPublicPath('/blog')).toBe(true)
    expect(isPublicPath('/blog/hello')).toBe(true)
    expect(isPublicPath('/news')).toBe(true)
  })

  it('規約まわりも公開', () => {
    expect(isPublicPath('/privacy')).toBe(true)
    expect(isPublicPath('/terms')).toBe(true)
    expect(isPublicPath('/tokushoho')).toBe(true)
  })

  it('門と最初のページも公開', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/signup')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('ログインが要る画面は公開ではない', () => {
    expect(isPublicPath('/entrance')).toBe(false)
    expect(isPublicPath('/items')).toBe(false)
    expect(isPublicPath('/achievements')).toBe(false)
    expect(isPublicPath('/billing')).toBe(false)
  })

  // 前方一致で判じるので、名前の似た別の道を巻き込まないこと
  it('名前が似ているだけの道は巻き込まない', () => {
    expect(isPublicPath('/guidebook')).toBe(false)
    expect(isPublicPath('/newsletter')).toBe(false)
    expect(isPublicPath('/blogs')).toBe(false)
  })

  it('道が分からないときは公開扱いにしない', () => {
    expect(isPublicPath(null)).toBe(false)
    expect(isPublicPath(undefined)).toBe(false)
    expect(isPublicPath('')).toBe(false)
  })
})
