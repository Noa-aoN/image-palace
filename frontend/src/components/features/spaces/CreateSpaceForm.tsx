'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSpace } from '@/lib/api/spaces'
import { SPACE_TYPES, spaceTypeLabel, spaceTypeDescription } from '@/lib/space-types'
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="種別" hint={spaceTypeDescription(spaceType)}>
        <select
          value={spaceType}
          onChange={(e) => setSpaceType(e.target.value)}
          disabled={submitting}
          aria-label="スペースの種別"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SPACE_TYPES.map((t) => (
            <option key={t} value={t}>
              {spaceTypeLabel(t)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="名前">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={spaceType === 'road' ? '例: 通勤路、家の中' : '例: 英単語、文法'}
          autoFocus
          disabled={submitting}
          aria-label="スペース名"
        />
      </Field>
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

/**
 * 1 項目分の枠。ラベルを上、操作を下に置いて縦に積む。
 * 横 1 行に詰めると右パネルのような狭い幅で潰れるため、幅に依存しない形にしている。
 */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
