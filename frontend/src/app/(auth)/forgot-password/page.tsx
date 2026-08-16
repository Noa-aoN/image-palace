import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm'

export const metadata: Metadata = { title: 'パスワード再設定' }

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-md rounded-2xl px-10 py-12 sm:px-12 sm:py-14"
        style={{ border: '1px solid var(--palace)' }}
      >
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
