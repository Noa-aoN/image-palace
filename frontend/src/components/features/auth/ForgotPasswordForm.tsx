'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset } from '@/lib/api/auth'
import { buildForgotPasswordErrorMessage, validateForgotPasswordEmail } from '@/lib/auth-errors'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validateForgotPasswordEmail(email)
    setFieldError(validation)

    if (validation) {
      setFormError(null)
      return
    }

    setFormError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSubmitted(true)
    } catch (err: unknown) {
      setFormError(buildForgotPasswordErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#111111' }}>
          メールを送信しました
        </h1>
        <p className="text-sm leading-6 mb-6" style={{ color: '#4A4A4A' }}>
          ご入力のメールアドレス宛に、パスワード再設定用のリンクをお送りしました。
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>
        <p className="text-sm text-center" style={{ color: '#4A4A4A' }}>
          <Link href="/login" className="underline" style={{ color: '#111111' }}>
            ログイン画面に戻る
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#111111' }}>
        パスワードを再設定
      </h1>
      <p className="text-sm leading-6 mb-6" style={{ color: '#4A4A4A' }}>
        ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setFieldError(validateForgotPasswordEmail(email))}
            required
            autoComplete="email"
            aria-invalid={fieldError ? true : undefined}
          />
          {fieldError && <p className="text-sm text-red-700">{fieldError}</p>}
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
          {loading ? '送信中...' : '再設定メールを送信'}
        </Button>
      </form>

      <p className="text-sm text-center mt-6" style={{ color: '#4A4A4A' }}>
        <Link href="/login" className="underline" style={{ color: '#111111' }}>
          ログイン画面に戻る
        </Link>
      </p>
    </div>
  )
}
