'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import type { View } from '@/types/view'

function ViewsPageInner() {
  // ?type=freeboard / space_map で種別フィルタ（サイドバー/ライブラリの導線から）
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type')

  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    getViews()
      .then((data) => {
        if (!cancelled) setViews(data)
      })
      .catch(() => {
        if (!cancelled) setError('キャンバスの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleViews = typeFilter ? views.filter((v) => v.view_type === typeFilter) : views
  const heading = typeFilter ? viewTypeLabel(typeFilter) : 'キャンバス'

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">{heading}</h1>
          {typeFilter && (
            <Link href="/views" className="text-sm hover:underline" style={{ color: 'var(--palace)' }}>
              すべてのキャンバス
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
        <div className="mb-8">
          <CreateViewForm
            defaultType={typeFilter ?? undefined}
            onCreated={(created) => {
              setViews((current) => [created, ...current])
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
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
