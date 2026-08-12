'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api/client'
import { isSubmitEnter } from '@/lib/enter-key'

/**
 * パスワードの変更。
 *
 * **いまのパスワードを必ず聞く。** 聞かないと、トークンさえ奪えば
 * パスワードごと乗っ取れてしまう（置き忘れた端末で、本人が締め出される）。
 * サーバー側でも同じ判断をする（`check_current_password_before_update`）。
 *
 * ふだんは畳んでおく。開いている必要がないものを開いておくと、
 * 登録情報を見に来ただけの人に入力欄が並ぶ。
 */
export function PasswordEditor() {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const ready = currentPassword !== '' && password !== '' && confirmation !== ''

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await apiClient.put('/api/v1/auth', {
        current_password: currentPassword,
        password,
        password_confirmation: confirmation,
      })
      setDone(true)
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
      setOpen(false)
    } catch (e) {
      const detail = (e as { response?: { data?: { errors?: string[] | { full_messages?: string[] } } } })
        ?.response?.data?.errors
      const messages = Array.isArray(detail) ? detail : detail?.full_messages
      setError(messages?.[0] ?? '変更できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">パスワード</dt>
        <dd>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? '閉じる' : '変更する'}
          </Button>
        </dd>
      </div>

      {done && !open && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">パスワードを変更しました。</p>
      )}

      {open && (
        <div className="mt-3 space-y-2.5">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">いまのパスワード</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password-confirmation">新しいパスワード（確認）</Label>
            <Input
              id="new-password-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              onKeyDown={(e) => {
                if (isSubmitEnter(e)) submit()
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={submit} disabled={!ready || busy} size="sm">
            {busy ? '変更しています…' : 'パスワードを変更'}
          </Button>
        </div>
      )}
    </div>
  )
}
