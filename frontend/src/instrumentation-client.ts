import * as Sentry from '@sentry/nextjs'

// Sentry の実際の初期化は SentryInit（通常のクライアントコンポーネント）で行う。
// Turbopack の本番ビルドでは instrumentation-client 内の NEXT_PUBLIC_* が
// インライン展開されず init が無効化されてしまうため、ここでは初期化しない。
// このファイルはナビゲーション計測フックの公開のみを担う。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
