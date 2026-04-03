'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp, googleOAuthUrl } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/auth'

export function SignupForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== passwordConfirmation) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    try {
      const { user, tokens } = await signUp(email, password, passwordConfirmation)
      setAuth(user, tokens)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { errors?: { full_messages?: string[] } } } })
          ?.response?.data?.errors?.full_messages?.[0]
        ?? '登録に失敗しました'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#111111' }}>
        パレスを作る
      </h1>

      <Button
        variant="outline"
        className="w-full mb-5"
        style={{ borderColor: '#E3E6EA' }}
        onClick={() => { window.location.href = googleOAuthUrl() }}
      >
        Google で登録
      </Button>

      <div className="mb-5 flex items-center gap-2">
        <div className="flex-1 border-t" style={{ borderColor: '#E3E6EA' }} />
        <span className="text-xs" style={{ color: '#4A4A4A' }}>またはメールで</span>
        <div className="flex-1 border-t" style={{ borderColor: '#E3E6EA' }} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password-confirmation">パスワード（確認）</Label>
          <Input
            id="password-confirmation"
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full mt-1">
          {loading ? '登録中...' : 'パレスを作る'}
        </Button>
      </form>

      <p className="text-sm text-center mt-6" style={{ color: '#4A4A4A' }}>
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="underline" style={{ color: '#111111' }}>
          ログイン
        </Link>
      </p>
    </div>
  )
}
