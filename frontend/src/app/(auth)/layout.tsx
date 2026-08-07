import ReactDOM from 'react-dom'
import { AuthFooter } from '@/components/features/layout/AuthFooter'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // 認証ページ限定で背景画像の取得を前倒し（CSS 背景の取得待ちを短縮）
  ReactDOM.preload('/auth-gate.webp', { as: 'image' })
  ReactDOM.preload('/auth-scene.webp', { as: 'image' })

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex items-center justify-center py-6 px-4">
        {children}
      </main>
      <AuthFooter />
    </div>
  )
}
