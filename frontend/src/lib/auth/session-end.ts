import * as Sentry from '@sentry/nextjs'
import { isPublicPath } from '@/lib/auth/public-paths'

/**
 * セッションが切れたときの記録と、次の画面への申し送り。
 *
 * 「気づいたらログアウトしていた」は、**起きたあとでは調べようがない**。
 * どの画面で・どの API が 401 を返し・そのときトークンの期限がいつだったのかを
 * 残しておかないと、期限切れなのか不具合なのかが永久に決まらない。
 *
 * 実際、公開ページを読んでいる最中のログアウトを調べたとき、手元では
 * 再現できず、本番で何が起きたのかを確かめる手立てが無かった。
 * 次に起きたときに原因を決められるよう、ここで印を残す。
 */
export type SessionEndRecord = {
  /** 起きた時刻 */
  at: string
  /** そのとき見ていた画面 */
  pathname: string
  /** 401 を返した API */
  api: string
  /** その画面がログイン無しで読めるページか */
  publicPage: boolean
  /** 落としたトークンの期限（持っていなければ null） */
  tokenExpiry: string | null
  /** 期限が既に過ぎていたか。**期限切れと不具合を分ける決め手** */
  expired: boolean | null
  /** ログイン画面へ送ったか。公開ページでは送らずに留める */
  redirected: boolean
}

/**
 * 次の画面で案内を出すための申し送り。
 *
 * localStorage ではなく sessionStorage に置く。この知らせは
 * 「いま切れた」ことを次の1画面で伝えるためのもので、
 * 別の日に開いたときにまで残っていてはいけない。
 */
export const SESSION_END_KEY = 'session-ended'

/** devise-token-auth の expiry は**秒**。ミリ秒として読むと1970年になる */
export function expiryToDate(expiry: string | null | undefined): Date | null {
  if (!expiry) return null
  const seconds = Number(expiry)
  if (!Number.isFinite(seconds) || seconds <= 0) return null

  return new Date(seconds * 1000)
}

export function buildSessionEndRecord({
  pathname,
  api,
  tokenExpiry,
  redirected,
  now,
}: {
  pathname: string
  api: string
  tokenExpiry: string | null | undefined
  redirected: boolean
  now: Date
}): SessionEndRecord {
  const expiresAt = expiryToDate(tokenExpiry)

  return {
    at: now.toISOString(),
    pathname,
    api,
    publicPage: isPublicPath(pathname),
    tokenExpiry: expiresAt ? expiresAt.toISOString() : null,
    expired: expiresAt ? expiresAt.getTime() <= now.getTime() : null,
    redirected,
  }
}

/**
 * 記録を残す。**ここで例外を投げない。**
 * 観測のために落ちては本末転倒なので、失敗しても黙って諦める
 * （記録が無いことより、記録を取ろうとして画面が壊れるほうが困る）。
 */
export function reportSessionEnd(record: SessionEndRecord) {
  try {
    // 開発中は手元のログで足りる。本番は Sentry に集める
    console.warn('[auth] セッションを終了しました', record)

    Sentry.captureMessage('auth session ended (401)', {
      level: 'warning',
      // 個人を特定するものは載せない。**どの画面・どの API・期限だけ**
      extra: { ...record },
      tags: {
        auth_session_end: 'true',
        public_page: String(record.publicPage),
        token_expired: String(record.expired),
        redirected: String(record.redirected),
      },
    })

    // ログイン画面へ送るときだけ、次の画面で理由を出せるように渡す。
    // 公開ページはそのまま読めるので、毎回の知らせは出さない
    if (record.redirected && typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_END_KEY, JSON.stringify(record))
    }
  } catch {
    // 観測のために画面を壊さない
  }
}

/** 申し送りを1度だけ読む（読んだら消す。戻ってくるたびに出さない） */
export function takeSessionEndNotice(): SessionEndRecord | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(SESSION_END_KEY)
    if (!raw) return null

    window.sessionStorage.removeItem(SESSION_END_KEY)
    return JSON.parse(raw) as SessionEndRecord
  } catch {
    return null
  }
}
