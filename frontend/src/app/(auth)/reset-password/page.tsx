import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm'

export const metadata: Metadata = { title: '新しいパスワードを設定' }

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-md rounded-2xl px-10 py-12 sm:px-12 sm:py-14"
        style={{ border: '1px solid var(--palace)' }}
      >
        <Suspense fallback={
          <p className="text-sm text-center" style={{ color: '#4A4A4A' }}>
            確認中...
          </p>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
