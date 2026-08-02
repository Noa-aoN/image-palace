import type { Metadata } from 'next'
import { GalleryHorizontal } from 'lucide-react'
import { ItemList } from '@/components/features/items/ItemList'
import { CardCreateButton, CardCreatePanelSlot } from '@/components/features/items/CardCreatePanel'

export const metadata: Metadata = { title: 'カード' }

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <GalleryHorizontal size={26} style={{ color: 'var(--palace)' }} />
          カード一覧
        </h1>
        <CardCreateButton variant="default" label="カードを作成" />
      </div>
      {/* 右パネルでのカード作成。開いている間だけパネルへ描かれる */}
      <CardCreatePanelSlot />
      <ItemList initialTag={tag ?? null} />
    </div>
  )
}
