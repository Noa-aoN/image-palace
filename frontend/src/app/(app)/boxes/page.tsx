'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { getCollections } from '@/lib/api/collections'
import { CreateCollectionForm } from '@/components/features/collections/CreateCollectionForm'
import { EntityCover } from '@/components/features/shared/EntityCover'
import type { Collection } from '@/types/collection'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCollections()
      .then((data) => {
        if (!cancelled) setCollections(data)
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">ボックス</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
        )}
      </div>

      {creating && (
        <div className="mb-8">
          <CreateCollectionForm
            onCreated={(created) => {
              setCollections((current) => [created, ...current])
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : collections.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだボックスがありません。カードをテーマごとにまとめてみましょう。
          </p>
          {!creating && (
            <Button onClick={() => setCreating(true)}>最初のボックスを作成</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/boxes/${collection.id}`}
              className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium truncate">{collection.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{collection.entry_count} 件</span>
              </div>
              <div className="w-full aspect-square bg-muted overflow-hidden">
                <EntityCover cover={collection} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
