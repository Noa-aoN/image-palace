import { describe, it, expect } from 'vitest'
import { showSignUpCta } from '@/lib/auth/header-cta'

// 検索や共有から公開の読みものに直に降りてきた人には、ヘッダーが唯一の入口になる。
// **空けておくと、読んだあと行き場が無い。**
describe('ヘッダーの登録導線', () => {
  const base = { hasHydrated: true, isAuthenticated: false, pathname: '/blog/x' }

  it('未ログインで読みものを見ている人には出す', () => {
    expect(showSignUpCta(base)).toBe(true)
  })

  it('ログインしている人には出さない', () => {
    expect(showSignUpCta({ ...base, isAuthenticated: true })).toBe(false)
  })

  it('分かる前は出さない（ログイン済みの人に一瞬見えてしまう）', () => {
    expect(showSignUpCta({ ...base, hasHydrated: false })).toBe(false)
  })

  it('門では出さない（その画面自体が登録とログインの場）', () => {
    for (const pathname of ['/login', '/signup', '/auth/callback']) {
      expect(showSignUpCta({ ...base, pathname }), pathname).toBe(false)
    }
  })

  it('最初のページでは出さない（自前の導線を持つ）', () => {
    expect(showSignUpCta({ ...base, pathname: '/' })).toBe(false)
  })

  it('パスが分からないうちは出さない', () => {
    expect(showSignUpCta({ ...base, pathname: null })).toBe(false)
  })
})
