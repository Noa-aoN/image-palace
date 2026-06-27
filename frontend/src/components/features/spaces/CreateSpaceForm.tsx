'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSpace } from '@/lib/api/spaces'
import { SPACE_TYPES, spaceTypeLabel } from '@/lib/space-types'
import type { Space } from '@/types/space'

interface Props {
  onCreated?: (space: Space) => void
  redirectBase?: string
  onCancel?: () => void
  // 初期種別（ライブラリの ?type 導線などから）。
  defaultType?: string
}

/**
 * スペース作成フォーム。一覧ページのインライン作成と /spaces/new で共有する。
 */
export function CreateSpaceForm({ onCreated, redirectBase, onCancel, defaultType }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [spaceType, setSpaceType] = useState(
    defaultType && (SPACE_TYPES as readonly string[]).includes(defaultType) ? defaultType : 'room'
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('スペース名を入力してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createSpace(trimmed, spaceType)
      setName('')
      setSpaceType('room')
      onCreated?.(created)
      if (redirectBase) router.push(`${redirectBase}/${created.id}`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? 'スペースの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <select
        value={spaceType}
        onChange={(e) => setSpaceType(e.target.value)}
        disabled={submitting}
        aria-label="スペースの種別"
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {SPACE_TYPES.map((t) => (
          <option key={t} value={t}>
            {spaceTypeLabel(t)}
          </option>
        ))}
      </select>
      <div className="flex-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={spaceType === 'road' ? 'ロード名（例: 通勤路、家の中）' : 'ルーム名（例: 英単語、文法）'}
          autoFocus
          disabled={submitting}
          aria-label="スペース名"
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
