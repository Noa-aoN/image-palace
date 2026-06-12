'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Sentry のブラウザ初期化。
// 通常のクライアントコンポーネントとして読み込むことで、Turbopack の本番ビルドでも
// NEXT_PUBLIC_SENTRY_DSN が確実にインライン展開される
// （instrumentation-client.ts 内では Turbopack が NEXT_PUBLIC_* を展開しないため init が無効化される）。
// DSN が未設定なら初期化せず、外部送信は発生しない。
let initialized = false

export function SentryInit() {
  useEffect(() => {
    if (initialized) return

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (!dsn) return

    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
      tracesSampleRate: 0.1,
    })
    initialized = true
  }, [])

  return null
}
