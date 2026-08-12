'use client'

import { useCallback, useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import { Check, Copy, Download, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { HelpPopover } from '@/components/ui/help-popover'
import {
  getTotpStatus,
  startTotpEnrollment,
  confirmTotp,
  disableTotp,
  type TotpStatus,
} from '@/lib/api/totp'
import {
  formatRecoveryCodes,
  recoveryCodesFilename,
  recoveryCodesRunningLow,
} from '@/lib/recovery-codes'

/**
 * 二要素認証の設定。
 *
 * **秘密鍵と復旧コードは、画面に出す以外のことをしない。**
 * localStorage にも sessionStorage にも置かず、console にも出さない。
 * 置いた先が漏れれば、二要素が二要素でなくなる。
 *
 * QR はブラウザの中で作る。外部の QR 生成サービスへ送ると、
 * 秘密鍵をそのまま第三者へ渡すことになる。
 *
 * 途中でやめても有効にはならない（サーバー側が、コードの確認まで進んで
 * 初めて有効にする）。閉じた人が中途半端な状態で締め出されない。
 */
type Step = 'idle' | 'enrolling' | 'saved'

export function TwoFactorSettings() {
  const [status, setStatus] = useState<TotpStatus | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [secret, setSecret] = useState<string | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disabling, setDisabling] = useState(false)

  const reload = useCallback(() => {
    getTotpStatus()
      .then(setStatus)
      .catch(() => setError('読み込めませんでした'))
  }, [])

  useEffect(reload, [reload])

  const begin = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await startTotpEnrollment()
      setSecret(result.secret)
      setUri(result.provisioning_uri)
      setCode('')
      setStep('enrolling')
    } catch {
      setError('始められませんでした。時間を置いてお試しください。')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await confirmTotp(code)
      setCodes(result.recovery_codes)
      // 鍵はもう要らない。持ち続ける理由がない
      setSecret(null)
      setUri(null)
      setCode('')
      setStep('saved')
      reload()
    } catch {
      setError('コードが合いません。認証アプリの表示と、端末の時計を確かめてください。')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    try {
      await disableTotp(code)
      setCode('')
      setDisabling(false)
      reload()
    } catch {
      setError('コードが合いません。認証アプリのコード、または復旧コードを入れてください。')
    } finally {
      setBusy(false)
    }
  }

  if (status === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  // 控えを取り終えるまでは、この画面から離さない
  if (step === 'saved' && codes) {
    return <RecoveryCodes codes={codes} onDone={() => setStep('idle')} />
  }

  if (step === 'enrolling' && secret && uri) {
    return (
      <Enrollment
        secret={secret}
        uri={uri}
        code={code}
        busy={busy}
        error={error}
        onCode={setCode}
        onConfirm={confirm}
        onCancel={() => {
          setStep('idle')
          setSecret(null)
          setUri(null)
          setError(null)
        }}
      />
    )
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        {status.enrolled ? (
          <ShieldCheck size={18} style={{ color: 'var(--palace)' }} />
        ) : (
          <ShieldOff size={18} className="text-muted-foreground" />
        )}
        <h2 className="text-lg font-semibold">二要素認証</h2>
        <span className="text-sm text-muted-foreground">{status.enrolled ? '設定済み' : '未設定'}</span>
        {/* 見出しの並びの終わりに置く。主操作（設定する）より目立たせない */}
        <span className="ml-auto">
          <HelpPopover label="二要素認証について" title="二要素認証とは">
            <p>
              認証アプリに出る6桁の数字で本人確認する方法です。数字は30秒ごとに変わるので、
              一度のぞき見られても使い回せません。
            </p>
            <p>
              Google Authenticator・1Password・Microsoft Authenticator などが使えます。
            </p>
            <p>
              パスキーが使えない端末や、パスキーを登録していないときの控えになります。
            </p>
            <p>
              端末を失っても、設定のときにお渡しする
              <strong className="text-foreground">復旧コード</strong>で入れます。
              <strong className="text-foreground">人に見せず、安全な場所に控えてください。</strong>
            </p>
          </HelpPopover>
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        認証アプリの6桁コードを、合言葉に添えて使います。合言葉だけを知られても、入られません。
      </p>

      {status.enrolled ? (
        <>
          <p className="text-sm">
            残りの復旧コード: <span className="font-medium tabular-nums">{status.recovery_codes_left}</span> 本
            {recoveryCodesRunningLow(status.recovery_codes_left) && (
              <span className="ml-2 text-xs text-destructive">少なくなっています。作り直しをお勧めします</span>
            )}
          </p>

          {disabling ? (
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <p className="text-sm">外すには、いまのコードを入れてください。</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6桁のコード、または復旧コード"
                  autoComplete="one-time-code"
                  className="w-56"
                  disabled={busy}
                />
                <Button size="sm" variant="destructive" onClick={disable} disabled={busy || !code.trim()}>
                  {busy && <Spinner size={13} />}
                  外す
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setDisabling(false); setError(null) }} disabled={busy}>
                  やめる
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDisabling(true)}>
              二要素認証を外す
            </Button>
          )}
        </>
      ) : (
        <>
          <Button size="sm" onClick={begin} disabled={busy} className="flex items-center gap-1.5">
            {busy ? <Spinner size={13} /> : <ShieldCheck size={14} />}
            設定する
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </section>
  )
}

function Enrollment({
  secret,
  uri,
  code,
  busy,
  error,
  onCode,
  onConfirm,
  onCancel,
}: {
  secret: string
  uri: string
  code: string
  busy: boolean
  error: string | null
  onCode: (next: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  // QR はブラウザの中で作る。外の生成サービスへ送ると、鍵をそのまま渡すことになる
  const svg = renderSVG(uri, { border: 2 })

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">二要素認証を設定する</h2>

      <ol className="space-y-4 text-sm">
        <li className="space-y-2">
          <p className="font-medium">1. 認証アプリで読み取る</p>
          {/* dangerouslySetInnerHTML は uqr が作った SVG のみ。外から来た文字列は入らない */}
          <div
            className="inline-block rounded-lg bg-white p-2"
            aria-label="二要素認証のQRコード"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          {/* QR を読めない端末のために、手入力の道も必ず用意する */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">読み取れないときは、この文字列を手で入れてください。</p>
            <code className="block rounded bg-muted px-2 py-1.5 font-mono text-xs break-all">{secret}</code>
          </div>
        </li>

        <li className="space-y-2">
          <p className="font-medium">2. 表示された6桁を入れる</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={code}
              onChange={(e) => onCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-40 font-mono tracking-widest"
              disabled={busy}
            />
            <Button size="sm" onClick={onConfirm} disabled={busy || code.trim().length < 6}>
              {busy && <Spinner size={13} />}
              確認する
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              やめる
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </li>
      </ol>

      <p className="text-xs text-muted-foreground">
        ここでやめても、二要素認証は有効になりません。設定し直せます。
      </p>
    </section>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const text = formatRecoveryCodes(codes, new Date())

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  const download = () => {
    // ブラウザの中だけで作る。どこにも送らない
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = recoveryCodesFilename(new Date())
    link.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">設定できました</h2>
      </div>

      {/* サーバーはハッシュで持っているので、あとから出し直せない */}
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <strong>この画面を閉じると、二度と表示できません。</strong>
        認証アプリを使えなくなったとき、このコードで入れます。いま控えてください。
      </p>

      <ul className="grid gap-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm sm:grid-cols-2">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy} className="flex items-center gap-1.5">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'コピーしました' : 'まとめてコピー'}
        </Button>
        <Button size="sm" variant="outline" onClick={download} className="flex items-center gap-1.5">
          {downloaded ? <Check size={14} /> : <Download size={14} />}
          {downloaded ? '保存しました' : 'ファイルに保存'}
        </Button>
      </div>

      {/* 控えたことを自分で確かめてから閉じる。押さないと閉じられない */}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>控えました（この画面を閉じると再表示できません）</span>
      </label>

      <Button size="sm" onClick={onDone} disabled={!acknowledged}>
        閉じる
      </Button>
    </section>
  )
}
