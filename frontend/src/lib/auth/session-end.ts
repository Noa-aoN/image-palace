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
  /**
   * サーバーが言ってきた理由。
   *
   * **期限が切れていないのに終わることがある。** 使い続けているセッションを
   * 一定の日数で必ず打ち切る決まり（`session_expired`）があり、
   * そのときトークンの期限はまだ先にある。理由を残さないと、
   * `expired: false` の記録が不具合と見分けられない。
   */
  reason: string | null
  /** ログイン画面へ送ったか。公開ページでは送らずに留める */
  redirected: boolean
}

/**
 * 次の画面へ「なぜここに居るのか」を渡す印。
 *
 * **URL に載せる。** はじめは sessionStorage で渡していたが、
 * 書き込みと画面の移動が別々に起きるため、途中で落ちても気づけない
 * （実際、記録の失敗に巻き込まれて申し送りが消え、ログイン画面に
 *   何の説明も出ない状態になっていた）。
 *
 * 行き先の URL に付けてしまえば、全再読み込みでも確実に届く。
 * 印は読んだら URL から消すので、貼り付けても残らない。
 */
export const SESSION_END_PARAM = 'session'
export const SESSION_END_VALUE = 'expired'

/** 期限切れで送るときの行き先 */
export function loginPathWithNotice(): string {
  return `/login?${SESSION_END_PARAM}=${SESSION_END_VALUE}`
}

/**
 * いま 401 でセッションを落としたばかりか。
 *
 * **ログイン画面へ送るのは、こちらとは別の場所**（AuthGuard）でも起きる。
 * 認証が外れたことに気づいた側が router で送るため、そちらのほうが先に着く。
 * どちらが送っても同じ案内を出せるよう、直前に切れたことをここで覚えておく。
 *
 * 覚えているのは同じ画面の中だけでよい（送るのは即座に起きる）。
 * 全再読み込みで消えるが、そのときは URL の印のほうが残る。
 */
let endedJustNow = false

export function markSessionEnded() {
  endedJustNow = true
}

export function sessionEndedJustNow(): boolean {
  return endedJustNow
}

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
  reason,
}: {
  pathname: string
  api: string
  tokenExpiry: string | null | undefined
  redirected: boolean
  now: Date
  /** サーバーが言ってきた理由（`session_expired` など） */
  reason?: string | null
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
    reason: reason ?? null,
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
  } catch {
    // 観測のために画面を壊さない
  }
}

/**
 * 期限切れで送られてきたか。**読んだら URL から印を消す。**
 *
 * 残したままだと、再読み込みのたびに同じ知らせが出るうえ、
 * その URL を誰かに渡したときにも出てしまう。
 */
export function takeSessionEndNotice(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get(SESSION_END_PARAM) !== SESSION_END_VALUE) return false

    url.searchParams.delete(SESSION_END_PARAM)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    return true
  } catch {
    return false
  }
}
