'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import type { View } from '@/types/view'

function ViewsPageInner() {
  // ?type=freeboard / space_map で種別フィルタ（サイドバー/ライブラリの導線から）
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type')

  // 前回描いていた内容があれば、それを初期値にして即座に描く。
  // 取得は従来どおり裏で走り、終わり次第上書きする。
  const [cached] = useState(() => readPageCache<View[]>(CACHE_KEY))

  const [views, setViews] = useState<View[]>(cached ?? [])
  // 描くものが既にあるなら、読み込み中の表示は出さない
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  // 画面の内容をそのままキャッシュへ写す。作成・削除で state を触った結果も
  // ここを通るので、キャッシュだけ古いという食い違いが起きない。
  useEffect(() => {
    if (loading) return
    writePageCache(CACHE_KEY, views)
  }, [loading, views])

  // 作成はその場に展開せず右パネルで行う
  const createForm = usePanelForm('view-create', 'キャンバスを作成')

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
  const heading = typeFilter ? `${viewTypeLabel(typeFilter)}一覧` : 'キャンバス一覧'

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* 見出しは「ここが何の一覧か」だけ。押せるものは一覧の上の操作列に集める */}
      <div className="mb-2 flex items-baseline gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <LayoutGrid size={26} style={{ color: 'var(--palace)' }} />
          {heading}
        </h1>
        {typeFilter && (
          <Link href="/views" className="text-sm hover:underline" style={{ color: 'var(--palace)' }}>
            すべてのキャンバス
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        カードを自由に配置するフリーボード。関係性を視覚的に整理できます。
      </p>

      <PanelSlotContent sectionKey="view-create">
        <div>
          <CreateViewForm
            defaultType={typeFilter ?? undefined}
            onCreated={(created) => {
              setViews((current) => [created, ...current])
              createForm.close()
            }}
            onCancel={() => createForm.close()}
          />
        </div>
      </PanelSlotContent>

      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : visibleViews.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだ{heading}がありません。作成してカードを配置してみましょう。
          </p>
          <Button onClick={() => createForm.open()}>{heading}を作成</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => createForm.open()} className="flex items-center gap-1.5">
              <Plus size={16} />
              作成
            </Button>
          </div>
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
        </div>
      )}
    </div>
  )
}

const CACHE_KEY = 'views-list'

export default function ViewsPage() {
  // useSearchParams は Suspense 境界が必要
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-12 text-muted-foreground">読み込み中…</div>}>
      <ViewsPageInner />
    </Suspense>
  )
}
