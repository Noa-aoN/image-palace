'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getViews, createView } from '@/lib/api/views'
import { getSpaces } from '@/lib/api/spaces'
import { VIEW_TYPES, viewTypeLabel, IMPLEMENTED_VIEW_TYPES } from '@/lib/view-types'
import { spaceTypeLabel } from '@/lib/space-types'
import { EntityCover } from '@/components/features/shared/EntityCover'
import type { View } from '@/types/view'
import type { Space } from '@/types/space'

function ViewsPageInner() {
  // ?type=freeboard / space_map で種別フィルタ（サイドバー/ライブラリの導線から）
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type')

  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [viewType, setViewType] = useState(
    typeFilter && (VIEW_TYPES as readonly string[]).includes(typeFilter) ? typeFilter : 'freeboard'
  )
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // space_map 用: 配置先スペースの候補と選択
  const [spaces, setSpaces] = useState<Space[]>([])
  const [selectedSpaceId, setSelectedSpaceId] = useState('')

  // スペース配置を選んだら配置先スペースの候補を読み込む
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

  const visibleViews = typeFilter ? views.filter((v) => v.view_type === typeFilter) : views
  const heading = typeFilter ? viewTypeLabel(typeFilter) : 'ビュー'

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">{heading}</h1>
          {typeFilter && (
            <Link href="/views" className="text-sm hover:underline" style={{ color: 'var(--palace)' }}>
              すべてのビュー
            </Link>
          )}
        </div>
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
                <option key={s.id} value={s.id}>{s.name}（{spaceTypeLabel(s.space_type)}）</option>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : visibleViews.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだ{heading}がありません。作成してカードを配置してみましょう。
          </p>
          {!creating && <Button onClick={() => setCreating(true)}>{heading}を作成</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visibleViews.map((view) => (
            <Link
              key={view.id}
              href={`/views/${view.id}`}
              className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium truncate">{view.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{viewTypeLabel(view.view_type)}</span>
              </div>
              <div className="w-full aspect-square bg-muted overflow-hidden">
                <EntityCover cover={view} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ViewsPage() {
  // useSearchParams は Suspense 境界が必要
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-12 text-muted-foreground">読み込み中…</div>}>
      <ViewsPageInner />
    </Suspense>
  )
}
