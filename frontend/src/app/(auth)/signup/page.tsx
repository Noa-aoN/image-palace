import type { Metadata } from 'next'
import { SignupForm } from '@/components/features/auth/SignupForm'

export const metadata: Metadata = { title: '新規登録' }

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-sm rounded-2xl px-8 py-10"
        style={{ border: '1px solid var(--palace)' }}
      >
        <SignupForm />
      </div>
    </div>
  )
}
