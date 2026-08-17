'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, Plus, Box as BoxIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { cardGridClass } from '@/lib/card-grid'
import { deleteBox, getBoxes } from '@/lib/api/boxes'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { EntityDisplayPanel } from '@/components/features/shared/EntityDisplayPanel'
import { EntitySelectionBar } from '@/components/features/shared/EntitySelectionBar'
import { EntityTile } from '@/components/features/shared/EntityTile'
import { sortEntities, useEntityListDisplay } from '@/hooks/useEntityListDisplay'
import { useEntitySelection } from '@/hooks/useEntitySelection'
import type { Box } from '@/types/box'

const CACHE_KEY = 'boxes-list'

export default function BoxesPage() {
  // 前回描いていた内容があれば、それを初期値にして即座に描く。
  // 取得は従来どおり裏で走り、終わり次第上書きする。
  const [cached] = useState(() => readPageCache<Box[]>(CACHE_KEY))

  const [boxes, setBoxes] = useState<Box[]>(cached ?? [])
  // 描くものが既にあるなら、読み込み中の表示は出さない
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  const { display, change } = useEntityListDisplay('boxes')
  const rows = sortEntities(boxes, display.sort, { name: (b) => b.name, count: (b) => b.entry_count })
  const selection = useEntitySelection(rows)

  // 画面の内容をそのままキャッシュへ写す。作成・削除で state を触った結果も
  // ここを通るので、キャッシュだけ古いという食い違いが起きない。
  useEffect(() => {
    if (loading) return
    writePageCache(CACHE_KEY, boxes)
  }, [loading, boxes])

  // 作成はその場に展開せず右パネルで行う
  const createForm = usePanelForm('box-create', `ボックスを作成`)

  useEffect(() => {
    let cancelled = false
    getBoxes()
      .then((data) => {
        if (!cancelled) setBoxes(data)
      })
      .catch(() => {
        if (!cancelled) setError('ボックスの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const removeSelected = async () => {
    const { done, failed } = await selection.run(deleteBox)
    setBoxes((current) => current.filter((box) => !done.includes(box.id)))
    if (failed > 0) setError(`${failed}件を削除できませんでした`)
  }

  // 押せるものは一覧の上の操作列に集める。並びはカード一覧と同じ [選択][表示][作成]
  const actions = (
    <>
      <EntityDisplayPanel panelKey="boxes" display={display} onChange={change} metaLabel="カードの数" />
      <Button size="sm" variant="outline" onClick={() => createForm.open()} className="flex items-center gap-1.5">
        <Plus size={16} />
        作成
      </Button>
    </>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* 見出しは「ここが何の一覧か」だけ。押せるものは一覧の上の操作列に集める */}
      <h1 className="mb-2 flex items-center gap-2.5 text-2xl font-semibold">
        <BoxIcon size={26} style={{ color: 'var(--palace)' }} />
        ボックス一覧
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        カードやスペース、キャンバスをまとめる入れ物。テーマごとに整理して保存できます。
      </p>

      <PanelSlotContent sectionKey="box-create">
        <div>
          <CreateBoxForm
            onCreated={(created) => {
              setBoxes((current) => [created, ...current])
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
      ) : boxes.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだボックスがありません。カードやスペース、キャンバスをテーマごとにまとめてみましょう。
          </p>
          <Button onClick={() => createForm.open()}>最初のボックスを作成</Button>
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
            {rows.map((box) => (
              <EntityTile
                key={box.id}
                href={`/boxes/${box.id}`}
                name={box.name}
                meta={display.showMeta ? `${box.entry_count} 件` : null}
                cover={<EntityCover cover={box} />}
                selecting={selection.selecting}
                selected={selection.selected.has(box.id)}
                onSelect={() => selection.toggle(box.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
