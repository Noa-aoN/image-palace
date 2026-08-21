// 体験用の宮殿の、手元側の覚え書き。
//
// 一度入った人が「宮殿を見てみる」をもう一度押したとき、
// **新しく建てずに、さっきの宮殿へ戻す**ための合鍵を持つ。
//
// Cookie は使わない。画面（imagepalace.app）と API（api.imagepalace.app）は
// オリジンが違い、CORS で credentials を許していないので届かない。
// かわりに、サーバーが署名した合鍵をここに置く。
// **署名があるので、書き換えて他人の宮殿を指すことはできない。**

const STORAGE_KEY = 'demo-resume-token'

// 画面が自分で作って持つ合言葉。
//
// **合鍵は1回目の返事を受け取ってからしか持てない。**
// だから「初めての1回」がほぼ同時に2本出ると、宮殿が2つ建つ。
// こちらは要求を出す前に作れるので、その隙間を塞げる。
//
// サーバー側は一意索引で守っている。ここが無くても宮殿は建つ（塞げないだけ）
const CLIENT_KEY = 'demo-client-key'

/** その宮殿が体験用かどうかの目印。バックエンドと綴りを揃える */
export const DEMO_EMAIL_DOMAIN = 'demo.invalid'

export function readResumeToken(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // 保存が使えない（プライベートモード等）。合鍵が無いだけで、宮殿は建つ
    return null
  }
}

export function saveResumeToken(token: string | null | undefined): void {
  if (typeof window === 'undefined' || !token) return

  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // 保存できなくても止めない
  }
}

/**
 * 合言葉を読む。無ければ作って覚える。
 *
 * **消さない。** 体験を終えても同じ合言葉のままでよく、
 * サーバーは「生きている宮殿」だけを引くので、消えたあとは新しく建つ。
 */
export function readOrCreateClientKey(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const existing = window.localStorage.getItem(CLIENT_KEY)
    if (existing) return existing

    const created = window.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(CLIENT_KEY, created)
    return created
  } catch {
    // 保存が使えない（プライベートモード等）。合言葉が無いだけで、宮殿は建つ
    return null
  }
}

export function clearResumeToken(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 消せなくても止めない
  }
}

/**
 * その人が体験用の宮殿に居るか。
 *
 * **役割では見分けられない。** 体験用は一般より下ではなく、
 * 「できることが狭い」だけなので、目印はメールの後ろ側にある。
 */
export function isDemoUser(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email
  if (!email) return false

  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}

/** あと何日で消えるか。切り上げる（「あと0日」と出さないため） */
export function daysLeft(expiresAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null

  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(expires)) return null

  const ms = expires - now.getTime()
  if (ms <= 0) return 0

  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/** 残り時間の言い方。1日を切ったら時間で言う（そのほうが正直） */
export function remainingLabel(expiresAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!expiresAt) return null

  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(expires)) return null

  const ms = expires - now.getTime()
  if (ms <= 0) return 'まもなく消えます'

  const hours = Math.ceil(ms / (60 * 60 * 1000))
  if (hours <= 24) return `あと約${hours}時間`

  return `あと約${Math.ceil(hours / 24)}日`
}
