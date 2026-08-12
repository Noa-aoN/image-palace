'use client'

import { useEffect, useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { Fingerprint, KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  getReauthStatus,
  startReauthPasskey,
  verifyReauthPasskey,
  verifyReauthCode,
  type StrongAuthMethod,
} from '@/lib/api/reauth'

/**
 * 危険な操作の前に、もう一度ご本人か確かめる。
 *
 * **パスキーを先に出す。** いちばん手数が少なく、押して指を置けば終わる。
 * それが使えない人のために「別の方法」を畳んで置く。
 * 最初から選択肢を並べると、どれを選べばよいか考えることになる。
 *
 * 確かめ方は3つあるが、**通ったあとは同じ**。呼ぶ側は
 * 「確かめ終わったか」だけを見て、どれで通ったかを知らない。
 */
export function StrongAuthPrompt({
  reason,
  onDone,
  onCancel,
}: {
  /** 何のために確かめるのか。「権限を変えるため」など */
  reason: string
  onDone: () => void
  onCancel?: () => void
}) {
  const [methods, setMethods] = useState<StrongAuthMethod[] | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReauthStatus()
      .then((status) => {
        setMethods(status.methods)
        // パスキーが無ければ、最初からコードの入力欄を出す
        if (!status.methods.includes('passkey')) setShowCode(true)
      })
      .catch(() => setError('読み込めませんでした'))
  }, [])

  const withPasskey = async () => {
    setBusy(true)
    setError(null)
    try {
      const { options } = await startReauthPasskey()
      const credential = await startAuthentication({ optionsJSON: options })
      await verifyReauthPasskey({ credential, challenge: options.challenge })
      onDone()
    } catch (err: unknown) {
      // 途中でやめただけのときは、失敗として騒がない
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return
      setError('確認できませんでした。別の方法もお使いいただけます。')
      setShowCode(true)
    } finally {
      setBusy(false)
    }
  }

  const withCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await verifyReauthCode(code.trim())
      onDone()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error ?? 'コードが合いません。')
    } finally {
      setBusy(false)
    }
  }

  if (methods === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  // 何も用意していない人には、先に用意してもらう
  if (methods.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm">
          この操作の前に、ご本人か確かめさせてください。まだ確かめる手立てが登録されていません。
        </p>
        <p className="text-xs text-muted-foreground">
          「セキュリティ」から、パスキーか認証アプリを設定してください。
        </p>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            閉じる
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} style={{ color: 'var(--palace)' }} />
        <p className="text-sm font-medium">ご本人か確かめさせてください</p>
      </div>
      <p className="text-xs text-muted-foreground">{reason}</p>

      {/* いちばん手数が少ないものを先に、大きく出す */}
      {methods.includes('passkey') && (
        <Button size="sm" onClick={withPasskey} disabled={busy} className="flex w-full items-center gap-1.5">
          {busy ? <Spinner size={13} /> : <Fingerprint size={14} />}
          パスキーで確認
        </Button>
      )}

      {showCode ? (
        <div className="space-y-2">
          <label htmlFor="reauth-code" className="block text-xs font-medium">
            認証アプリの6桁、または復旧コード
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="reauth-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void withCode()
                }
              }}
              placeholder="123456"
              autoComplete="one-time-code"
              disabled={busy}
              className="w-44 font-mono tracking-widest"
            />
            <Button size="sm" onClick={withCode} disabled={busy || !code.trim()}>
              {busy && <Spinner size={13} />}
              確認する
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <KeyRound size={12} />
          別の方法を使う
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {onCancel && (
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          やめる
        </Button>
      )}
    </div>
  )
}
