import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignupForm } from '@/components/features/auth/SignupForm'
import { FromDemoNote } from '@/components/features/auth/FromDemoNote'

export const metadata: Metadata = { title: '新規登録' }

export default function SignupPage() {
  return (
    <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-6">
      {/* 最奥の風景（ギリシャの山と道）＋その手前の大理石アーチ門。カードが門の開口部に収まる構図 */}
      <div aria-hidden className="auth-scene" />
      <div aria-hidden className="auth-scene--near" />
      <div aria-hidden className="auth-arch" />
      {/* 乳白色フィルター（門の手前・カードの奥） */}
      <div aria-hidden className="auth-veil" />
      <div
        className="relative w-full max-w-md rounded-2xl px-10 py-12 sm:px-12 sm:py-14 backdrop-blur-[2px]"
        style={{ border: '1px solid var(--palace)', backgroundColor: 'rgba(255, 254, 250, 0.72)' }}
      >
        {/* どこから来たかを見るので、描き出しは待たせない
            （読み込み中は何も出さない。案内が遅れても登録は進められる） */}
        <Suspense fallback={null}>
          <FromDemoNote />
        </Suspense>
        <SignupForm />
      </div>
    </div>
  )
}
