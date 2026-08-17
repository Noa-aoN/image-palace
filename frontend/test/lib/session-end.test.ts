import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildSessionEndRecord,
  expiryToDate,
  loginPathWithNotice,
  takeSessionEndNotice,
} from '@/lib/auth/session-end'

// この記録が「期限切れだったのか、そうでないのか」を決める唯一の手がかりになる。
// 形が崩れると、次に起きたときも原因が分からないまま終わる
describe('セッション終了の記録', () => {
  const now = new Date('2026-08-17T10:00:00.000Z')
  // devise-token-auth の expiry は秒。ミリ秒として読むと1970年になる
  const inOneHour = String(Math.floor(now.getTime() / 1000) + 3600)
  const oneHourAgo = String(Math.floor(now.getTime() / 1000) - 3600)

  it('期限は秒として読む', () => {
    expect(expiryToDate(inOneHour)?.toISOString()).toBe('2026-08-17T11:00:00.000Z')
  })

  it('期限が無い・壊れているときは null', () => {
    expect(expiryToDate(null)).toBeNull()
    expect(expiryToDate('')).toBeNull()
    expect(expiryToDate('あした')).toBeNull()
    expect(expiryToDate('0')).toBeNull()
  })

  // 期限切れなら仕様どおり、切れていないなら不具合。**ここが切り分けの要**
  it('期限が過ぎていれば expired になる', () => {
    const record = buildSessionEndRecord({
      pathname: '/entrance',
      api: '/api/v1/notifications/unread_count',
      tokenExpiry: oneHourAgo,
      redirected: true,
      now,
    })

    expect(record.expired).toBe(true)
    expect(record.tokenExpiry).toBe('2026-08-17T09:00:00.000Z')
    expect(record.at).toBe('2026-08-17T10:00:00.000Z')
  })

  it('期限が残っていれば expired にならない（不具合の疑い）', () => {
    const record = buildSessionEndRecord({
      pathname: '/entrance',
      api: '/api/v1/items',
      tokenExpiry: inOneHour,
      redirected: true,
      now,
    })

    expect(record.expired).toBe(false)
  })

  it('期限を持っていなければ、切れていたかは判じない', () => {
    const record = buildSessionEndRecord({
      pathname: '/entrance',
      api: '/api/v1/items',
      tokenExpiry: null,
      redirected: true,
      now,
    })

    expect(record.expired).toBeNull()
    expect(record.tokenExpiry).toBeNull()
  })

  it('公開ページかどうかを残す', () => {
    const base = { api: '/api/v1/items', tokenExpiry: inOneHour, now }

    expect(buildSessionEndRecord({ ...base, pathname: '/guide/faq', redirected: false }).publicPage).toBe(true)
    expect(buildSessionEndRecord({ ...base, pathname: '/entrance', redirected: true }).publicPage).toBe(false)
  })

  it('ログイン画面へ送ったかを残す', () => {
    const base = { api: '/api/v1/items', tokenExpiry: inOneHour, now }

    expect(buildSessionEndRecord({ ...base, pathname: '/entrance', redirected: true }).redirected).toBe(true)
    expect(buildSessionEndRecord({ ...base, pathname: '/blog', redirected: false }).redirected).toBe(false)
  })
})

describe('ログイン画面への申し送り', () => {
  const go = (url: string) => window.history.replaceState(null, '', url)

  beforeEach(() => go('/login'))

  it('期限切れで送られてきたら知らせる', () => {
    go(loginPathWithNotice())

    expect(takeSessionEndNotice()).toBe(true)
  })

  // 残したままだと、再読み込みのたびに同じ知らせが出る。
  // その URL を誰かに渡したときにも出てしまう
  it('読んだら URL から印を消す', () => {
    go(loginPathWithNotice())
    takeSessionEndNotice()

    expect(window.location.search).toBe('')
    expect(takeSessionEndNotice()).toBe(false)
  })

  it('ほかの問い合わせは消さない', () => {
    go(`/login?next=%2Fitems&${'session'}=expired`)
    takeSessionEndNotice()

    expect(window.location.search).toBe('?next=%2Fitems')
  })

  it('印が無ければ知らせない', () => {
    expect(takeSessionEndNotice()).toBe(false)
  })

  it('別の値では知らせない', () => {
    go('/login?session=whatever')

    expect(takeSessionEndNotice()).toBe(false)
  })
})
