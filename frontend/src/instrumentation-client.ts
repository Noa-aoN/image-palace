import * as Sentry from '@sentry/nextjs'

// ブラウザ側のエラーモニタリング（Cloudflare Workers ランタイムに依存しない）。
// NEXT_PUBLIC_SENTRY_DSN が未設定なら初期化せず、外部送信は発生しない。
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.1,
    // 既定でも本文は送られないが、二要素の経路だけは明示して落とす。
    // 秘密鍵や復旧コードが、事故の記録に紛れて外へ出る道を残さない
    beforeSend(event) {
      const url = event.request?.url ?? ''
      if (url.includes('/api/v1/totp')) return null

      return event
    },
    beforeBreadcrumb(breadcrumb) {
      const url = String(breadcrumb.data?.url ?? '')
      if (url.includes('/api/v1/totp')) return null

      return breadcrumb
    },
  })
}

// App Router のナビゲーション計測フック
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
