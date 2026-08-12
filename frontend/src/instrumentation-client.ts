import * as Sentry from '@sentry/nextjs'

// ブラウザ側のエラーモニタリング（Cloudflare Workers ランタイムに依存しない）。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら初期化せず、外部送信は発生しない。
// 秘密が通る経路。事故の記録に紛れて外へ出る道を残さない
const SECRET_PATHS = ['/api/v1/totp', '/api/v1/passkeys']

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.1,
    // 既定でも本文は送られないが、秘密の通る経路は明示して落とす
    beforeSend(event) {
      const url = event.request?.url ?? ''
      if (SECRET_PATHS.some((path) => url.includes(path))) return null

      return event
    },
    beforeBreadcrumb(breadcrumb) {
      const url = String(breadcrumb.data?.url ?? '')
      if (SECRET_PATHS.some((path) => url.includes(path))) return null

      return breadcrumb
    },
  })
}

// App Router のナビゲーション計測フック
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
