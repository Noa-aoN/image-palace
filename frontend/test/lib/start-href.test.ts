import { describe, it, expect } from 'vitest'
import { startHref, SIGN_UP_PATH } from '@/lib/auth/start-href'

// 公開のページに置く行き先。**押した先で追い返さない**ことが要。
describe('公開ページからの行き先', () => {
  it('ログインしている人は、そのまま目的の場所へ', () => {
    expect(startHref('/items/new', { ready: true, isAuthenticated: true })).toBe('/items/new')
  })

  it('ログインしていない人は登録へ（門で追い返されない）', () => {
    expect(startHref('/items/new', { ready: true, isAuthenticated: false })).toBe(SIGN_UP_PATH)
  })

  it('まだ分からないうちは登録側を出す（サーバー側では判定できない）', () => {
    expect(startHref('/items/new', { ready: false, isAuthenticated: true })).toBe(SIGN_UP_PATH)
  })
})
