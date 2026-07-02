'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { UserRound, Sparkles, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { STYLE_OPTIONS } from '@/lib/item-styles'
import { generateAvatar, deleteAvatar, getProfile } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'

const MAX_PROMPT = 300

// プロンプトからプロフィールアイコンを生成する（非同期・1cr）。
// 生成トリガ後はプロフィールをポーリングして完了/失敗まで待つ。
export function AvatarGenerator() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)

  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photo')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avatarUrl = user?.avatar_thumb_url ?? user?.avatar_url ?? null
  // 拡大・ダウンロードは原寸（サムネでなく本体）を使う。
  const fullAvatarUrl = user?.avatar_url ?? user?.avatar_thumb_url ?? null
  const status = user?.avatar_generation_status ?? null
  const generating = submitting || status === 'pending' || status === 'processing'

  const available = billing?.available_credits ?? null
  const insufficient = available != null && available < 1

  const clearPoll = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }

  const poll = useCallback(async () => {
    try {
      const p = await getProfile()
      updateUser({
        avatar_url: p.avatar_url,
        avatar_thumb_url: p.avatar_thumb_url,
        avatar_generation_status: p.avatar_generation_status,
      })
      if (p.avatar_generation_status === 'pending' || p.avatar_generation_status === 'processing') {
        pollRef.current = setTimeout(poll, 3000)
      } else {
        pollRef.current = null
        setSubmitting(false)
        if (p.avatar_generation_status === 'failed') {
          setError(p.avatar_generation_error ?? '生成に失敗しました。時間を置いてお試しください。')
        }
        fetchBilling()
      }
    } catch {
      pollRef.current = null
      setSubmitting(false)
    }
  }, [updateUser, fetchBilling])

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  // 拡大表示中は Escape で閉じる。
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  // 生成中に離脱→戻った場合など、pending/processing のままなら再開する。
  useEffect(() => {
    if ((status === 'pending' || status === 'processing') && !pollRef.current) {
      pollRef.current = setTimeout(poll, 2000)
    }
    return clearPoll
    // マウント時のみ再開判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || generating) return
    setSubmitting(true)
    setError(null)
    try {
      const p = await generateAvatar(trimmed, style)
      updateUser({ avatar_generation_status: p.avatar_generation_status })
      fetchBilling()
      clearPoll()
      pollRef.current = setTimeout(poll, 2000)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '生成に失敗しました。時間を置いてお試しください。')
      setSubmitting(false)
    }
  }

  const handleDownload = async () => {
    if (!fullAvatarUrl) return
    try {
      const res = await fetch(fullAvatarUrl)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `image-palace-avatar.${blob.type.includes('png') ? 'png' : 'webp'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      // CORS 等で fetch できない場合は新規タブで開く（そこから保存できる）。
      window.open(fullAvatarUrl, '_blank', 'noopener')
    }
  }

  const handleDelete = async () => {
    try {
      const p = await deleteAvatar()
      updateUser({
        avatar_url: p.avatar_url,
        avatar_thumb_url: p.avatar_thumb_url,
        avatar_generation_status: p.avatar_generation_status,
      })
    } catch {
      setError('削除に失敗しました。')
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {generating ? (
            <Spinner size={20} label="生成中" />
          ) : avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="プロフィールアイコン"
              className="size-16 cursor-zoom-in object-cover"
              decoding="async"
              onClick={() => setZoomed(true)}
            />
          ) : (
            <UserRound size={28} className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">プロフィールアイコン</p>
          <p className="text-xs text-muted-foreground">
            {generating ? '生成中です。数十秒お待ちください…' : 'プロンプトから自分だけのアイコンを生成できます。'}
          </p>
          {avatarUrl && !generating && (
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download size={12} /> ダウンロード
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={12} /> 削除
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="avatar-prompt" className="mb-1 block text-sm font-medium">
            プロンプト
          </label>
          <Input
            id="avatar-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例: 星を見上げる白い猫"
            maxLength={MAX_PROMPT}
            disabled={generating}
          />
        </div>
        <div className="w-32">
          <label htmlFor="avatar-style" className="mb-1 block text-sm font-medium">
            スタイル
          </label>
          <select
            id="avatar-style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={generating}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STYLE_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || insufficient || !prompt.trim()}
          className="flex items-center justify-center gap-2 sm:w-36"
        >
          {generating ? <Spinner size={15} /> : <Sparkles size={16} />}
          {generating ? '生成中…' : '生成する'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        生成には1クレジット消費します{available != null ? `（残り ${available} cr）` : ''}。
      </p>
      {insufficient && (
        <p className="text-xs text-destructive">
          クレジットが不足しています。
          <Link href="/billing" className="ml-1 underline">
            プランを見る
          </Link>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {zoomed && fullAvatarUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="プロフィールアイコン（拡大）"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullAvatarUrl}
            alt="プロフィールアイコン"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </section>
  )
}
