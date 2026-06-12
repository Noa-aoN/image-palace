'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// ルートレイアウトを含む致命的エラーの捕捉。Sentry へ送信しつつ最小限の画面を出す。
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            fontFamily: 'system-ui, sans-serif',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>予期しないエラーが発生しました</h1>
          <p style={{ color: '#666' }}>時間を置いて、もう一度お試しください。</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  )
}
