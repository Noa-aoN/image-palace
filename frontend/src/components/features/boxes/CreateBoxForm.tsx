'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBox } from '@/lib/api/boxes'
import type { Box } from '@/types/box'

interface Props {
  // 一覧ページ用: 作成後に一覧へ反映する。
  onCreated?: (box: Box) => void
  // /new ページ用: 作成後に `${redirectBase}/${id}` へ遷移する。
  redirectBase?: string
  onCancel?: () => void
}

/**
 * ボックス作成フォーム。一覧ページのインライン作成と /boxes/new で共有する。
 */
export function CreateBoxForm({ onCreated, redirectBase, onCancel }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('ボックス名を入力してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createBox(trimmed)
      setName('')
      onCreated?.(created)
      if (redirectBase) router.push(`${redirectBase}/${created.id}`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? 'ボックスの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">名前</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 英単語、Rails用語"
          autoFocus
          disabled={submitting}
          aria-label="ボックス名"
        />
        <span className="block text-xs text-muted-foreground">
          種類を問わず、カードもキャンバスもまとめて入れておけます。
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
        )}
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? '作成中...' : '作成'}
        </Button>
      </div>
    </form>
  )
}
