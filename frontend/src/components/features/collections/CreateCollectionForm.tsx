'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCollection } from '@/lib/api/collections'
import type { Collection } from '@/types/collection'

interface Props {
  // 一覧ページ用: 作成後に一覧へ反映する。
  onCreated?: (collection: Collection) => void
  // /new ページ用: 作成後に `${redirectBase}/${id}` へ遷移する。
  redirectBase?: string
  onCancel?: () => void
}

/**
 * コレクション作成フォーム。一覧ページのインライン作成と /collections/new で共有する。
 */
export function CreateCollectionForm({ onCreated, redirectBase, onCancel }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('コレクション名を入力してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createCollection(trimmed)
      setName('')
      onCreated?.(created)
      if (redirectBase) router.push(`${redirectBase}/${created.id}`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? 'コレクションの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="コレクション名（例: 英単語、Rails用語）"
          autoFocus
          disabled={submitting}
          aria-label="コレクション名"
        />
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? '作成中...' : '作成'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
        )}
      </div>
    </form>
  )
}
