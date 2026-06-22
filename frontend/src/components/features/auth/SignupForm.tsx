'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/features/auth/PasswordField'
import { AppleIcon } from '@/components/features/auth/AppleIcon'
import { signUp, googleOAuthUrl, appleOAuthUrl, APPLE_AUTH_ENABLED } from '@/lib/api/auth'
import {
  buildSignupErrorDetail,
  type AuthFieldErrors,
  validateSignupEmail,
  validateSignupPassword,
  validateSignupPasswordConfirmation,
} from '@/lib/auth-errors'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

export function SignupForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const resetItems = useItemsStore((s) => s.resetItems)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null)
  const [formMessages, setFormMessages] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [loading, setLoading] = useState(false)

  function updateFieldError(field: keyof AuthFieldErrors, message?: string) {
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
      email: validateSignupEmail(email),
      password: validateSignupPassword(password),
      passwordConfirmation: validateSignupPasswordConfirmation(password, passwordConfirmation),
    }
    const hasFieldErrors = Object.values(nextFieldErrors).some(Boolean)

    setFieldErrors({
      ...(nextFieldErrors.email ? { email: nextFieldErrors.email } : {}),
      ...(nextFieldErrors.password ? { password: nextFieldErrors.password } : {}),
      ...(nextFieldErrors.passwordConfirmation
        ? { passwordConfirmation: nextFieldErrors.passwordConfirmation }
        : {}),
    })

    if (hasFieldErrors) {
      setSummaryMessage('入力内容をご確認ください。')
      setFormMessages([])
      return
    }

    setSummaryMessage(null)
    setFormMessages([])
    setLoading(true)
    try {
      const { user, tokens } = await signUp(email, password, passwordConfirmation)
      resetItems()
      setAuth(user, tokens)
      router.push('/dashboard')
    } catch (err: unknown) {
      const detail = buildSignupErrorDetail(err)
      setSummaryMessage(detail.summaryMessage)
      setFormMessages(detail.formMessages)
      setFieldErrors(detail.fieldErrors)
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
        className={APPLE_AUTH_ENABLED ? 'w-full mb-3' : 'w-full mb-5'}
        style={{ borderColor: '#E3E6EA' }}
        onClick={() => { window.location.href = googleOAuthUrl() }}
      >
        Google で登録
      </Button>

      {APPLE_AUTH_ENABLED && (
        <Button
          variant="outline"
          className="w-full mb-5 gap-2"
          style={{ borderColor: '#E3E6EA' }}
          onClick={() => { window.location.href = appleOAuthUrl() }}
        >
          <AppleIcon />
          Apple で登録
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
            onBlur={() => updateFieldError('email', validateSignupEmail(email))}
            required
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
          />
          <p className="text-xs" style={{ color: '#4A4A4A' }}>
            ほかのユーザーが使っていないメールアドレスを入力してください。
          </p>
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
            onBlur={() => {
              updateFieldError('password', validateSignupPassword(password))
              if (passwordConfirmation) {
                updateFieldError(
                  'passwordConfirmation',
                  validateSignupPasswordConfirmation(password, passwordConfirmation)
                )
              }
            }}
            required
            autoComplete="new-password"
            minLength={8}
            aria-invalid={fieldErrors.password ? true : undefined}
          />
          <p className="text-xs" style={{ color: '#4A4A4A' }}>
            8文字以上で設定してください。
          </p>
          {fieldErrors.password && (
            <p className="text-sm text-red-700">{fieldErrors.password}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password-confirmation" required>パスワード（確認）</Label>
          <PasswordField
            id="password-confirmation"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            onBlur={() => updateFieldError(
              'passwordConfirmation',
              validateSignupPasswordConfirmation(password, passwordConfirmation)
            )}
            required
            autoComplete="new-password"
            minLength={8}
            aria-invalid={fieldErrors.passwordConfirmation ? true : undefined}
            showLabel="確認用パスワードを表示"
            hideLabel="確認用パスワードを隠す"
          />
          {fieldErrors.passwordConfirmation && (
            <p className="text-sm text-red-700">{fieldErrors.passwordConfirmation}</p>
          )}
        </div>

        {(summaryMessage || formMessages.length > 0) && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {summaryMessage && <p className="font-medium">{summaryMessage}</p>}
            {formMessages.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {formMessages.map((message) => (
                  <li key={message} className="leading-5">
                    {message}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
