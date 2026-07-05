import type { Metadata } from 'next'
import { LoginForm } from '@/components/features/auth/LoginForm'

export const metadata: Metadata = { title: 'ログイン' }

export default function LoginPage() {
  return (
    <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-6">
      {/* 最奥の風景（ギリシャの山と道）＋その手前の大理石アーチ門。カードが門の開口部に収まる構図 */}
      <div aria-hidden className="auth-scene" />
      <div aria-hidden className="auth-arch" />
      <div
        className="relative w-full max-w-sm rounded-2xl px-8 py-10 backdrop-blur-[2px]"
        style={{ border: '1px solid var(--palace)', backgroundColor: 'rgba(255, 254, 250, 0.72)' }}
      >
        <LoginForm />
      </div>
    </div>
  )
}
