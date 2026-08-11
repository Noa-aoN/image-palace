'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CircleCheck, Plus, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { cardGridClass } from '@/lib/card-grid'
import { deleteView, getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { CreateViewForm } from '@/components/features/views/CreateViewForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { EntityDisplayPanel } from '@/components/features/shared/EntityDisplayPanel'
import { EntitySelectionBar } from '@/components/features/shared/EntitySelectionBar'
import { EntityTile } from '@/components/features/shared/EntityTile'
import { sortEntities, useEntityListDisplay } from '@/hooks/useEntityListDisplay'
import { useEntitySelection } from '@/hooks/useEntitySelection'
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

  const { display, change } = useEntityListDisplay('views')

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
  // キャンバスは中身の数を持たないので、並べ替えは「新しい順 / 名前順」だけ
  const rows = sortEntities(visibleViews, display.sort, { name: (v) => v.name, count: () => 0 })
  const selection = useEntitySelection(rows)

  const removeSelected = async () => {
    const { done, failed } = await selection.run(deleteView)
    setViews((current) => current.filter((view) => !done.includes(view.id)))
    if (failed > 0) setError(`${failed}件を削除できませんでした`)
  }

  // 押せるものは一覧の上の操作列に集める。並びはカード一覧と同じ [選択][表示][作成]
  const actions = (
    <>
      <EntityDisplayPanel
        panelKey="views"
        display={display}
        onChange={change}
        metaLabel="種別"
        sorts={['recent', 'name']}
      />
      <Button size="sm" variant="outline" onClick={() => createForm.open()} className="flex items-center gap-1.5">
        <Plus size={16} />
        作成
      </Button>
    </>
  )

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
        <CardGridSkeleton columns={display.columns} />
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
          {selection.selecting ? (
            <EntitySelectionBar
              total={rows.length}
              selected={selection.selected.size}
              busy={selection.busy}
              onToggleAll={selection.toggleAll}
              onDelete={removeSelected}
              onCancel={selection.exit}
              right={actions}
            />
          ) : (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={selection.start}>
                <CircleCheck size={14} className="mr-1" />
                選択
              </Button>
              {actions}
            </div>
          )}

          <div className={`grid gap-4 ${cardGridClass(display.columns)}`}>
            {rows.map((view) => (
              <EntityTile
                key={view.id}
                href={`/views/${view.id}`}
                name={view.name}
                meta={display.showMeta ? viewTypeLabel(view.view_type) : null}
                cover={<EntityCover cover={view} />}
                selecting={selection.selecting}
                selected={selection.selected.has(view.id)}
                onSelect={() => selection.toggle(view.id)}
              />
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
