import { describe, it, expect } from 'vitest'
import { atLeast, canOperate, canAdminister, roleRank } from '@/lib/admin-roles'
import type { AdminSession } from '@/types/admin'

const as = (role: AdminSession['role']): AdminSession => ({
  role,
  admin: role !== 'user',
  owner: role === 'admin',
  strong_auth: { required: false, satisfied: false, prepared: false, methods: [] },
})

// 画面の出し分けは守りではないが、サーバーと食い違うと
// 「出ているのに押すと断られる」形で利用者に見える
describe('運営の段階', () => {
  it('上位は下位を含む', () => {
    expect(atLeast(as('operator'), 'support')).toBe(true)
    expect(atLeast(as('operator'), 'operator')).toBe(true)
    expect(atLeast(as('operator'), 'admin')).toBe(false)
  })

  it('support は見るだけ（配れない・お金も触れない）', () => {
    expect(canOperate(as('support'))).toBe(false)
    expect(canAdminister(as('support'))).toBe(false)
  })

  it('operator は配れるが、お金は触れない', () => {
    expect(canOperate(as('operator'))).toBe(true)
    expect(canAdminister(as('operator'))).toBe(false)
  })

  it('admin は両方できる', () => {
    expect(canOperate(as('admin'))).toBe(true)
    expect(canAdminister(as('admin'))).toBe(true)
  })

  // 読み込み前・ログアウト後。何も許さない側に倒す
  it('セッションが無ければ何もできない', () => {
    expect(roleRank(null)).toBe(0)
    expect(canOperate(null)).toBe(false)
    expect(canAdminister(undefined)).toBe(false)
  })

  it('一般は運営の操作ができない', () => {
    expect(canOperate(as('user'))).toBe(false)
  })
})
