'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// (app) 配下のルート単位エラー境界。1ページの描画エラーでアプリ全体が
// global-error まで落ちるのを防ぎ、ヘッダー/サイドバーを保ったまま復帰させる。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-lg font-semibold">問題が発生しました</h1>
      <p className="text-sm text-muted-foreground">
        このページの読み込み中にエラーが発生しました。時間を置いて再度お試しください。
      </p>
      <button
        onClick={() => reset()}
        className="mt-2 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
      >
        再試行
      </button>
    </div>
  )
}
