import type { Metadata } from 'next'
import { SignupForm } from '@/components/features/auth/SignupForm'

export const metadata: Metadata = { title: '新規登録' }

export default function SignupPage() {
  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-12"
      style={{
        background: `
          radial-gradient(ellipse at 70% 0%, rgba(198,167,94,0.25) 0%, transparent 55%),
          radial-gradient(ellipse at 20% 100%, rgba(139,105,20,0.2) 0%, transparent 55%),
          linear-gradient(160deg, #1a0f05 0%, #3d2410 25%, #6b4220 55%, #a8722a 80%, #c8954a 100%)
        `,
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl px-8 py-10 shadow-2xl"
        style={{ backgroundColor: 'rgba(244,239,230,0.95)', backdropFilter: 'blur(8px)' }}
      >
        <SignupForm />
      </div>
    </div>
  )
}
