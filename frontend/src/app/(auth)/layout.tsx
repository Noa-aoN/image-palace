import ReactDOM from 'react-dom'
import { Suspense } from 'react'
import { AuthFooter } from '@/components/features/layout/AuthFooter'
import { GuestOnly } from '@/components/features/auth/GuestOnly'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // 認証ページ限定で背景画像の取得を前倒し（CSS 背景の取得待ちを短縮）
  ReactDOM.preload('/auth-gate.webp', { as: 'image' })
  ReactDOM.preload('/auth-scene.webp', { as: 'image' })

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex items-center justify-center py-6 px-4">
        {/* 既に入っている人には門を見せない（中へ戻す）。
            `next` を読むので Suspense の内側に置く（静的化を外さないため） */}
        <Suspense fallback={null}>
          <GuestOnly>{children}</GuestOnly>
        </Suspense>
      </main>
      <AuthFooter />
    </div>
  )
}
