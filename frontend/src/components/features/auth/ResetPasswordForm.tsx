'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/features/auth/PasswordField'
import { resetPassword } from '@/lib/api/auth'
import {
  buildResetPasswordErrorDetail,
  type PasswordResetFieldErrors,
  validateResetPassword,
  validateResetPasswordConfirmation,
} from '@/lib/auth-errors'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { parseResetTokens, type ResetTokens } from '@/lib/auth/reset-tokens'

export function ResetPasswordForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const resetItems = useItemsStore((s) => s.resetItems)

  const [tokens, setTokens] = useState<ResetTokens | null>(null)
  const [tokensChecked, setTokensChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null)
  const [formMessages, setFormMessages] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<PasswordResetFieldErrors>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTokens(parseResetTokens(window.location.hash))
    setTokensChecked(true)
    // 読み終えたらアドレス欄から消す。履歴・ブックマークに合鍵を残さない
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  function updateFieldError(field: keyof PasswordResetFieldErrors, message?: string) {
    setFieldErrors((current) => {
      if (!message) {
        const next = { ...current }
        delete next[field]
        return next
      }
      return { ...current, [field]: message }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tokens) return

    const nextFieldErrors = {
      password: validateResetPassword(password),
      passwordConfirmation: validateResetPasswordConfirmation(password, passwordConfirmation),
    }
    const hasFieldErrors = Object.values(nextFieldErrors).some(Boolean)

    setFieldErrors({
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
      const result = await resetPassword(password, passwordConfirmation, tokens)
      resetItems()
      setAuth(result.user, result.tokens)
      router.push('/entrance')
    } catch (err: unknown) {
      const detail = buildResetPasswordErrorDetail(err)
      setSummaryMessage(detail.summaryMessage)
      setFormMessages(detail.formMessages)
      setFieldErrors(detail.fieldErrors)
    } finally {
      setLoading(false)
    }
  }

  if (!tokensChecked) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <p className="text-sm text-center" style={{ color: '#4A4A4A' }}>
          確認中...
        </p>
      </div>
    )
  }

  if (!tokens) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#111111' }}>
          リンクが無効です
        </h1>
        <p className="text-sm leading-6 mb-6" style={{ color: '#4A4A4A' }}>
          リセット用のリンクが無効、または期限が切れています。
          再度パスワードリセットをお試しください。
        </p>
        <p className="text-sm text-center" style={{ color: '#4A4A4A' }}>
          <Link href="/forgot-password" className="underline" style={{ color: '#111111' }}>
            パスワードを再設定する
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: '#111111' }}>
        新しいパスワードを設定
      </h1>
      <p className="text-sm leading-6 mb-6" style={{ color: '#4A4A4A' }}>
        新しいパスワードを 8 文字以上で入力してください。
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" required>新しいパスワード</Label>
          <PasswordField
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => {
              updateFieldError('password', validateResetPassword(password))
              if (passwordConfirmation) {
                updateFieldError(
                  'passwordConfirmation',
                  validateResetPasswordConfirmation(password, passwordConfirmation)
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
              validateResetPasswordConfirmation(password, passwordConfirmation)
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
          {loading ? '更新中...' : 'パスワードを更新'}
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
