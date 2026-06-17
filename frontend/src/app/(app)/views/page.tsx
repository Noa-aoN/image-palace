'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Frame, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getViews, createView } from '@/lib/api/views'
import { getSpaces } from '@/lib/api/spaces'
import { VIEW_TYPES, viewTypeLabel, IMPLEMENTED_VIEW_TYPES } from '@/lib/view-types'
import type { View } from '@/types/view'
import type { Space } from '@/types/space'

export default function ViewsPage() {
  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [viewType, setViewType] = useState('freeboard')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // space_map 用: 配置先スペースの候補と選択
  const [spaces, setSpaces] = useState<Space[]>([])
  const [selectedSpaceId, setSelectedSpaceId] = useState('')

  // スペースマッピングを選んだら配置先スペースの候補を読み込む
  useEffect(() => {
    if (viewType !== 'space_map' || spaces.length > 0) return
    getSpaces()
      .then(setSpaces)
      .catch(() => setCreateError('スペースの取得に失敗しました'))
  }, [viewType, spaces.length])

  useEffect(() => {
    let cancelled = false
    getViews()
      .then((data) => {
        if (!cancelled) setViews(data)
      })
      .catch(() => {
        if (!cancelled) setError('ビューの取得に失敗しました')
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
      setCreateError('ビュー名を入力してください')
      return
    }
    if (viewType === 'space_map' && !selectedSpaceId) {
      setCreateError('配置先のスペースを選択してください')
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      const created = await createView(
        trimmed,
        viewType,
        viewType === 'space_map' ? selectedSpaceId : undefined
      )
      setViews((current) => [created, ...current])
      setName('')
      setViewType('freeboard')
      setSelectedSpaceId('')
      setCreating(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setCreateError(axiosErr?.response?.data?.errors?.[0] ?? 'ビューの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">ビュー</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        カードを自由に配置するフリーボード。関係性を視覚的に整理できます。
      </p>

      {creating && (
        <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ビュー名（例: 関係図、学習マップ）"
              autoFocus
              disabled={submitting}
              aria-label="ビュー名"
            />
            {createError && <p className="mt-1 text-sm text-destructive">{createError}</p>}
          </div>
          <select
            value={viewType}
            onChange={(e) => setViewType(e.target.value)}
            disabled={submitting}
            aria-label="ビューの種別"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {VIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {viewTypeLabel(t)}
                {IMPLEMENTED_VIEW_TYPES.has(t) ? '' : '（準備中）'}
              </option>
            ))}
          </select>
          {viewType === 'space_map' && (
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              disabled={submitting}
              aria-label="配置先のスペース"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">スペースを選択…</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
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
            <div key={i} className="h-28 rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : views.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだビューがありません。フリーボードを作ってカードを配置してみましょう。
          </p>
          {!creating && <Button onClick={() => setCreating(true)}>最初のビューを作成</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {views.map((view) => (
            <Link
              key={view.id}
              href={`/views/${view.id}`}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2">
                <Frame size={18} style={{ color: 'var(--palace)' }} />
                <span className="font-medium truncate">{view.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{viewTypeLabel(view.view_type)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
