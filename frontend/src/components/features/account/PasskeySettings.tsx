'use client'

import { useCallback, useEffect, useState } from 'react'
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { Check, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { HelpPopover } from '@/components/ui/help-popover'
import { StrongAuthPrompt } from '@/components/features/account/StrongAuthPrompt'
import {
  listPasskeys,
  startPasskeyRegistration,
  finishPasskeyRegistration,
  renamePasskey,
  removePasskey,
  type Passkey,
} from '@/lib/api/passkeys'

/**
 * Passkey の管理。
 *
 * 指紋・顔・端末の暗証番号で入れるようにする。合言葉と違い、
 * 端末から出てこないので、盗み見ても他所では使えない。
 *
 * **鍵そのものはどこにも溜めない。** 画面が扱うのは、認証器への指示と
 * 返ってきた公開鍵だけ。localStorage にも console にも出さない。
 *
 * 詰め替え（ArrayBuffer ⇔ JSON）は `@simplewebauthn/browser` に任せる。
 * 自前で書くと、符号化を1つ間違えただけで「なぜか登録できない」になる。
 */
export function PasskeySettings() {
  const [keys, setKeys] = useState<Passkey[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  // 栓が閉じているか。**判断はサーバーが持つ**（画面にも旗を置くと、
  // 片方だけ倒したときに食い違う）。閉じていれば 503 が返る
  const [closed, setClosed] = useState(false)

  const reload = useCallback(() => {
    listPasskeys()
      .then(setKeys)
      .catch((err: { response?: { status?: number } }) => {
        if (err?.response?.status === 503) {
          setClosed(true)
          return
        }
        setError('読み込めませんでした')
      })
  }, [])

  useEffect(() => {
    setSupported(browserSupportsWebAuthn())
    reload()
  }, [reload])

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const { options } = await startPasskeyRegistration()
      const credential = await startRegistration({ optionsJSON: options })
      await finishPasskeyRegistration({ credential, challenge: options.challenge })
      reload()
    } catch (err: unknown) {
      // 利用者が途中でやめただけのときは、失敗として騒がない
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error ?? '登録できませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  // 栓が閉じているときは、何も出さない
  if (closed) return null

  if (keys === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">パスキー</h2>
        <span className="text-sm text-muted-foreground">{keys.length > 0 ? '設定済み' : '未設定'}</span>
        {/* 見出しの並びの終わりに置く。主操作（追加）より目立たせない */}
        <span className="ml-auto">
          <HelpPopover label="パスキーについて" title="パスキーとは">
            <p>
              指紋・顔・端末の暗証番号（Touch ID / Face ID / Windows Hello など）で本人確認する方法です。
              合言葉と違い、鍵が端末から出てこないので、のぞき見られても他所では使えません。
            </p>
            <p>
              いくつでも登録できます。パソコンと携帯の両方に入れておくと、片方を使えなくなっても困りません。
            </p>
            <p>
              登録したパスキーは、あとから名前を変えたり外したりできます。
              <strong className="text-foreground">外してもアカウントは消えません。</strong>
            </p>
            <p>
              パスキーが使えないときは、認証アプリ（下の「二要素認証」）や復旧コードでも本人確認できます。
            </p>
          </HelpPopover>
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        指紋・顔・端末の暗証番号で本人確認します。合言葉と違い、端末から出てこないので、
        のぞき見られても他所では使えません。
      </p>

      {!supported && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          このブラウザではパスキーを使えません。認証アプリ（下）をお使いください。
        </p>
      )}

      {keys.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-lg border border-border">
          {keys.map((key) => (
            <PasskeyRow key={key.id} passkey={key} onChanged={reload} onError={setError} />
          ))}
        </ul>
      )}

      {/* 1本だけだと、その端末を失った時点で使えなくなる。
          脅すのではなく、静かに勧める */}
      {keys.length === 1 && (
        <p className="text-xs text-muted-foreground">
          もう1つ登録しておくと、この端末を使えなくなったときも安心です。
        </p>
      )}

      {supported && (
        <Button size="sm" onClick={add} disabled={busy} className="flex items-center gap-1.5">
          {busy ? <Spinner size={13} /> : <Plus size={14} />}
          パスキーを追加
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}

function PasskeyRow({
  passkey,
  onChanged,
  onError,
}: {
  passkey: Passkey
  onChanged: () => void
  onError: (message: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(passkey.nickname ?? '')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // 外すのは、乗っ取った人が正規の鍵を消して締め出す道になる
  const [needsAuth, setNeedsAuth] = useState(false)

  const save = async () => {
    setBusy(true)
    onError(null)
    try {
      await renamePasskey(passkey.id, draft.trim())
      setEditing(false)
      onChanged()
    } catch {
      onError('名前を変えられませんでした')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    onError(null)
    try {
      await removePasskey(passkey.id)
      onChanged()
      setConfirming(false)
    } catch (err: unknown) {
      // 確かめが切れていたら、その場で確かめてもらう
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        setNeedsAuth(true)
        return
      }
      onError('外せませんでした')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  if (needsAuth) {
    return (
      <li className="px-3 py-2.5">
        <StrongAuthPrompt
          reason={`「${passkey.display_name}」を外すため`}
          onDone={() => {
            setNeedsAuth(false)
            void remove()
          }}
          onCancel={() => {
            setNeedsAuth(false)
            setConfirming(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      {editing ? (
        <>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
            }}
            placeholder="例: MacBook の指紋"
            maxLength={50}
            disabled={busy}
            autoFocus
            className="w-56"
          />
          <Button size="sm" onClick={save} disabled={busy} className="flex items-center gap-1">
            {busy ? <Spinner size={12} /> : <Check size={13} />}
            保存
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            <X size={13} />
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{passkey.display_name}</span>
            <span className="block text-xs text-muted-foreground">
              {passkey.last_used_at
                ? `最終利用: ${new Date(passkey.last_used_at).toLocaleDateString('ja-JP')}`
                : 'まだ使っていません'}
            </span>
          </span>

          {confirming ? (
            <>
              <span className="text-xs text-muted-foreground">外しますか？</span>
              <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
                {busy && <Spinner size={12} />}
                外す
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                やめる
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(passkey.nickname ?? '')
                  setEditing(true)
                }}
                aria-label="名前を変える"
              >
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label="外す">
                <Trash2 size={13} />
              </Button>
            </>
          )}
        </>
      )}
    </li>
  )
}
