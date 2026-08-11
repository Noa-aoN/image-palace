'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CircleCheck, Plus, Route, DoorOpen, Frame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { cardGridClass } from '@/lib/card-grid'
import { deleteSpace, getSpaces } from '@/lib/api/spaces'
import { spaceTypeLabel } from '@/lib/space-types'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { EntityDisplayPanel } from '@/components/features/shared/EntityDisplayPanel'
import { EntitySelectionBar } from '@/components/features/shared/EntitySelectionBar'
import { EntityTile } from '@/components/features/shared/EntityTile'
import { sortEntities, useEntityListDisplay } from '@/hooks/useEntityListDisplay'
import { useEntitySelection } from '@/hooks/useEntitySelection'
import type { Space } from '@/types/space'

// カバー画像が無いスペースのフォールバック（ルーム=部屋 / ロード=道アイコン）
function SpaceCoverFallback({ spaceType }: { spaceType: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      {spaceType === 'road' ? (
        <Route size={28} className="text-muted-foreground/50" />
      ) : (
        <DoorOpen size={28} className="text-muted-foreground/50" />
      )}
    </div>
  )
}

function SpacesPageInner() {
  // ?type=road / room で種別フィルタ（サイドバー/ライブラリの導線から）
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type')

  // 前回描いていた内容があれば、それを初期値にして即座に描く。
  // 取得は従来どおり裏で走り、終わり次第上書きする。
  const [cached] = useState(() => readPageCache<Space[]>(CACHE_KEY))

  const [spaces, setSpaces] = useState<Space[]>(cached ?? [])
  // 描くものが既にあるなら、読み込み中の表示は出さない
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  const { display, change } = useEntityListDisplay('spaces')

  // 画面の内容をそのままキャッシュへ写す。作成・削除で state を触った結果も
  // ここを通るので、キャッシュだけ古いという食い違いが起きない。
  useEffect(() => {
    if (loading) return
    writePageCache(CACHE_KEY, spaces)
  }, [loading, spaces])

  // 作成はその場に展開せず右パネルで行う
  const createForm = usePanelForm('space-create', 'スペースを作成')

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

  const visibleSpaces = typeFilter ? spaces.filter((s) => s.space_type === typeFilter) : spaces
  // スペースは一覧の時点で中身の数を持たないので、並べ替えは「新しい順 / 名前順」だけ
  const rows = sortEntities(visibleSpaces, display.sort, { name: (s) => s.name, count: () => 0 })
  const selection = useEntitySelection(rows)

  const removeSelected = async () => {
    const { done, failed } = await selection.run(deleteSpace)
    setSpaces((current) => current.filter((space) => !done.includes(space.id)))
    if (failed > 0) setError(`${failed}件を削除できませんでした`)
  }

  // 押せるものは一覧の上の操作列に集める。並びはカード一覧と同じ [選択][表示][作成]
  const actions = (
    <>
      <EntityDisplayPanel
        panelKey="spaces"
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
  const heading = typeFilter ? `${spaceTypeLabel(typeFilter)}一覧` : 'スペース一覧'

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* 見出しは「ここが何の一覧か」だけ。押せるものは一覧の上の操作列に集める */}
      <div className="mb-2 flex items-baseline gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Frame size={26} style={{ color: 'var(--palace)' }} />
          {heading}
        </h1>
        {typeFilter && (
          <Link href="/spaces" className="text-sm hover:underline" style={{ color: 'var(--palace)' }}>
            すべてのスペース
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        記憶の場所。種別を選んで作ります — ルーム（棚にボックスを並べる）/ ロード（順路にカードを置く連結法）。
      </p>

      <PanelSlotContent sectionKey="space-create">
        <div>
          <CreateSpaceForm
            defaultType={typeFilter ?? undefined}
            onCreated={(created) => {
              setSpaces((current) => [created, ...current])
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
      ) : visibleSpaces.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだ{heading}がありません。学習テーマごとに空間を作ってみましょう。
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
            {rows.map((space) => (
              <EntityTile
                key={space.id}
                href={`/spaces/${space.id}`}
                name={space.name}
                meta={display.showMeta ? spaceTypeLabel(space.space_type) : null}
                cover={
                  <EntityCover cover={space} fallback={<SpaceCoverFallback spaceType={space.space_type} />} />
                }
                selecting={selection.selecting}
                selected={selection.selected.has(space.id)}
                onSelect={() => selection.toggle(space.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const CACHE_KEY = 'spaces-list'

export default function SpacesPage() {
  // useSearchParams は Suspense 境界が必要
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-12 text-muted-foreground">読み込み中…</div>}>
      <SpacesPageInner />
    </Suspense>
  )
}
