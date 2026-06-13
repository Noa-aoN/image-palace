'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Route, DoorOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSpaces, createSpace } from '@/lib/api/spaces'
import { SPACE_TYPES, spaceTypeLabel } from '@/lib/space-types'
import type { Space } from '@/types/space'

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [spaceType, setSpaceType] = useState('room')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSpaces()
      .then((data) => {
        if (!cancelled) setSpaces(data)
      })
      .catch(() => {
        if (!cancelled) setError('スペースの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setCreateError('スペース名を入力してください')
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      const created = await createSpace(trimmed, spaceType)
      setSpaces((current) => [created, ...current])
      setName('')
      setSpaceType('room')
      setCreating(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setCreateError(axiosErr?.response?.data?.errors?.[0] ?? 'スペースの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">スペース</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        記憶の場所。種別を選んで作ります — ルーム（棚にコレクションを並べる）/ ロード（順路にカードを置く連結法）。
      </p>

      {creating && (
        <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start">
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
            {createError && <p className="mt-1 text-sm text-destructive">{createError}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? '作成中...' : '作成'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setCreating(false); setName(''); setCreateError(null) }}
              disabled={submitting}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : spaces.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだスペースがありません。学習テーマごとに空間を作ってみましょう。
          </p>
          {!creating && <Button onClick={() => setCreating(true)}>最初のスペースを作成</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {spaces.map((space) => (
            <Link
              key={space.id}
              href={`/spaces/${space.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2">
                {space.space_type === 'road' ? (
                  <Route size={18} style={{ color: 'var(--palace)' }} />
                ) : (
                  <DoorOpen size={18} style={{ color: 'var(--palace)' }} />
                )}
                <span className="font-medium truncate">{space.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{spaceTypeLabel(space.space_type)}</span>
              </div>
              {space.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{space.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
