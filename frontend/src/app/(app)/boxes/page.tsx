'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Box as BoxIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { getBoxes } from '@/lib/api/boxes'
import { CreateBoxForm } from '@/components/features/boxes/CreateBoxForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import type { Box } from '@/types/box'

export default function BoxesPage() {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <BoxIcon size={26} style={{ color: 'var(--palace)' }} />
          ボックス一覧
        </h1>
                  <Button size="sm" onClick={() => createForm.open()} className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        カードをテーマごとにまとめる入れ物。関連するカードを整理して保存できます。
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
        <CardGridSkeleton />
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : boxes.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだボックスがありません。カードをテーマごとにまとめてみましょう。
          </p>
                      <Button onClick={() => createForm.open()}>最初のボックスを作成</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {boxes.map((box) => (
            <Link
              key={box.id}
              href={`/boxes/${box.id}`}
              className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium truncate">{box.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{box.entry_count} 件</span>
              </div>
              <div className="w-full aspect-square bg-muted overflow-hidden">
                <EntityCover cover={box} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
