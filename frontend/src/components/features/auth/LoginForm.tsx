'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/features/auth/PasswordField'
import { AppleIcon } from '@/components/features/auth/AppleIcon'
import { signIn, googleOAuthUrl, appleOAuthUrl, APPLE_AUTH_ENABLED } from '@/lib/api/auth'
import { buildLoginErrorDetail, validateLoginField } from '@/lib/auth-errors'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

export function LoginForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const resetItems = useItemsStore((s) => s.resetItems)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  function updateFieldError(field: 'email' | 'password', message?: string) {
    setFieldErrors((current) => {
      if (!message) {
        const next = { ...current }
        delete next[field]
        return next
      }

      return {
        ...current,
        [field]: message,
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextFieldErrors = {
      email: validateLoginField('email', email),
      password: validateLoginField('password', password),
    }
    const hasFieldErrors = Object.values(nextFieldErrors).some(Boolean)

    setFieldErrors({
      ...(nextFieldErrors.email ? { email: nextFieldErrors.email } : {}),
      ...(nextFieldErrors.password ? { password: nextFieldErrors.password } : {}),
    })

    if (hasFieldErrors) {
      setFormError(null)
      return
    }

    setFormError(null)
    setLoading(true)
    try {
      const { user, tokens } = await signIn(email, password)
      resetItems()
      setAuth(user, tokens)
      router.push('/dashboard')
    } catch (err: unknown) {
      setFormError(buildLoginErrorDetail(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#111111' }}>
        パレスに入る
      </h1>

      <Button
        variant="outline"
        className={APPLE_AUTH_ENABLED ? 'w-full mb-3' : 'w-full mb-5'}
        style={{ borderColor: '#E3E6EA' }}
        onClick={() => { window.location.href = googleOAuthUrl() }}
      >
        Google でログイン
      </Button>

      {APPLE_AUTH_ENABLED && (
        <Button
          variant="outline"
          className="w-full mb-5 gap-2"
          style={{ borderColor: '#E3E6EA' }}
          onClick={() => { window.location.href = appleOAuthUrl() }}
        >
          <AppleIcon />
          Apple でログイン
        </Button>
      )}

      <div className="mb-5 flex items-center gap-2">
        <div className="flex-1 border-t" style={{ borderColor: '#E3E6EA' }} />
        <span className="text-xs" style={{ color: '#4A4A4A' }}>またはメールで</span>
        <div className="flex-1 border-t" style={{ borderColor: '#E3E6EA' }} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" required>メールアドレス</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => updateFieldError('email', validateLoginField('email', email))}
            required
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
          />
          {fieldErrors.email && (
            <p className="text-sm text-red-700">{fieldErrors.email}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" required>パスワード</Label>
          <PasswordField
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => updateFieldError('password', validateLoginField('password', password))}
            required
            autoComplete="current-password"
            aria-invalid={fieldErrors.password ? true : undefined}
          />
          {fieldErrors.password && (
            <p className="text-sm text-red-700">{fieldErrors.password}</p>
          )}
        </div>

        {formError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <p className="leading-5">{formError}</p>
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full mt-1">
          {loading ? 'ログイン中...' : 'パレスに入る'}
        </Button>
      </form>

      <p className="text-sm text-center mt-4" style={{ color: '#4A4A4A' }}>
        <Link href="/forgot-password" className="underline" style={{ color: '#111111' }}>
          パスワードを忘れた方はこちら
        </Link>
      </p>

      <p className="text-sm text-center mt-4" style={{ color: '#4A4A4A' }}>
        アカウントをお持ちでない方は{' '}
        <Link href="/signup" className="underline" style={{ color: '#111111' }}>
          新規登録
        </Link>
      </p>
    </div>
  )
}
