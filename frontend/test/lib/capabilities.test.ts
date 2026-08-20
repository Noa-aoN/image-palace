import { describe, it, expect } from 'vitest'
import { badgeFor, can, canAny, needsStrongAuth, opsEntriesFor } from '@/lib/auth/capabilities'

// できることの名前で、画面の出し分けを決める。
//
// **役割の文字列を画面に持ち込まない。** 持ち込むと、
// 出し分けの条件が役割で書かれ始め、役割が増えたときに全部を見直すことになる。
//
// ここは見た目の話であって守りではない。実際の判定はサーバー側が毎回行う。
const ops = { capabilities: { access_ops_room: true, support_users: true }, owner: false }
const admin = {
  capabilities: {
    access_ops_room: true,
    manage_billing: true,
    access_official_studio: true,
    publish_official_content: true,
  },
  owner: true,
}
const studio = { capabilities: { access_official_studio: true, edit_official_content: true }, owner: false }
const plain = { capabilities: {}, owner: false }

describe('できることの読み取り', () => {
  it('持っていれば true', () => {
    expect(can(admin, 'manage_billing')).toBe(true)
  })

  it('持っていなければ false', () => {
    expect(can(ops, 'manage_billing')).toBe(false)
  })

  // **分からないときは持っていない扱い。** 通信に失敗した直後に
  // 出してしまうと、押せない入口が並ぶ
  it('分からないときは持っていない扱い', () => {
    expect(can(null, 'access_ops_room')).toBe(false)
    expect(can(undefined, 'access_ops_room')).toBe(false)
    expect(can({ capabilities: undefined }, 'access_ops_room')).toBe(false)
  })

  it('どれか1つでも持っているか', () => {
    expect(canAny(studio, ['manage_billing', 'edit_official_content'])).toBe(true)
    expect(canAny(studio, ['manage_billing', 'manage_security'])).toBe(false)
  })
})

describe('公庁に出す入口', () => {
  it('運営には執務室', () => {
    expect(opsEntriesFor(ops)).toEqual({ opsRoom: true, officialStudio: false })
  })

  // ここが要。**制作だけの人に、運営の入口を見せない**
  it('制作だけの人には公式工房だけ', () => {
    expect(opsEntriesFor(studio)).toEqual({ opsRoom: false, officialStudio: true })
  })

  it('両方持っていれば両方', () => {
    expect(opsEntriesFor(admin)).toEqual({ opsRoom: true, officialStudio: true })
  })

  it('何も持っていなければ、どちらも出さない', () => {
    expect(opsEntriesFor(plain)).toEqual({ opsRoom: false, officialStudio: false })
    expect(opsEntriesFor(null)).toEqual({ opsRoom: false, officialStudio: false })
  })
})

describe('ヘッダーの肩書き', () => {
  it('運営には「運営」', () => {
    expect(badgeFor(ops)?.label).toBe('運営')
  })

  it('制作だけの人には「公式制作」', () => {
    expect(badgeFor(studio)?.label).toBe('公式制作')
    expect(badgeFor(studio)?.hint).toMatch(/公式コンテンツ/)
  })

  // **両方持っていることがある。** 2つ並べると狭い画面で場所を取り合うので、
  // 強いほう（運営）を出す
  it('両方持っていれば、強いほうを出す', () => {
    expect(badgeFor(admin)?.label).toBe('運営')
  })

  it('管理者かどうかで言い方が変わる', () => {
    expect(badgeFor(admin)?.hint).toMatch(/管理者/)
    expect(badgeFor(ops)?.hint).not.toMatch(/管理者/)
  })

  it('何も持っていなければ出さない', () => {
    expect(badgeFor(plain)).toBeNull()
    expect(badgeFor(null)).toBeNull()
  })
})

// 執務室と工房は、どちらも入るときに本人確認を求める。
// だから、どちらかに入れる人には設定が要る。
//
// **ここを役割で見ると、工房だけを使う口座が閉め出される。**
// 実際そうなった: studio@ は役割が user なので、
// セキュリティの設定が画面に出ず、パスキーを登録できなかった。
describe('本人確認が要る人', () => {
  it('運営には要る', () => {
    expect(needsStrongAuth(ops)).toBe(true)
  })

  // ここが肝
  it('制作だけの人にも要る', () => {
    expect(needsStrongAuth(studio)).toBe(true)
  })

  it('両方持っていれば、もちろん要る', () => {
    expect(needsStrongAuth(admin)).toBe(true)
  })

  it('一般の人には要らない（使わせないものを見せない）', () => {
    expect(needsStrongAuth(plain)).toBe(false)
  })

  it('分からないときは出さない', () => {
    expect(needsStrongAuth(null)).toBe(false)
    expect(needsStrongAuth(undefined)).toBe(false)
  })
})
