'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, Route, DoorOpen, Frame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { getSpaces } from '@/lib/api/spaces'
import { spaceTypeLabel } from '@/lib/space-types'
import { CreateSpaceForm } from '@/components/features/spaces/CreateSpaceForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
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
  const heading = typeFilter ? `${spaceTypeLabel(typeFilter)}一覧` : 'スペース一覧'

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-3">
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
                  <Button size="sm" onClick={() => createForm.open()} className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
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
        <CardGridSkeleton />
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visibleSpaces.map((space) => (
            <Link
              key={space.id}
              href={`/spaces/${space.id}`}
              className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium truncate">{space.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{spaceTypeLabel(space.space_type)}</span>
              </div>
              <div className="w-full aspect-square bg-muted overflow-hidden">
                <EntityCover cover={space} fallback={<SpaceCoverFallback spaceType={space.space_type} />} />
              </div>
            </Link>
          ))}
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
