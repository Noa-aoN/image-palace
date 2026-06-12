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
  })
}

// App Router のナビゲーション計測フック
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
